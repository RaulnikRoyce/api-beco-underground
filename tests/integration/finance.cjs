const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks');
const base = path.resolve(__dirname, '../..');
const load = createRequire(path.join(base, 'package.json'));
if (
  process.env.BECO_ALLOW_TEST_RESET !== 'yes' ||
  process.env.TEST_DB_NAME !== 'beco_test' ||
  !['127.0.0.1', 'localhost'].includes(process.env.TEST_DB_HOST)
)
  throw Error('Configure explicitamente o MySQL local descartavel beco_test e BECO_ALLOW_TEST_RESET=yes');
Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_HOST: process.env.TEST_DB_HOST,
  DB_PORT: process.env.TEST_DB_PORT || '3306',
  DB_USER: process.env.TEST_DB_USER,
  DB_PASSWORD: process.env.TEST_DB_PASSWORD,
  DB_NAME: 'beco_test',
  DB_SSL: 'false',
  JWT_SECRET: 'somente-teste-beco-segredo-local-32-bytes',
  MP_ACCESS_TOKEN: ''
});
global.fetch = async () => {
  throw Error('Rede externa bloqueada na auditoria financeira');
};
const mysql = load('mysql2/promise');
const db = load('./src/database/db');
const pedido = load('./src/services/pedido.service');
const repo = load('./src/repositories/pedido.repository');
const ingRepo = load('./src/repositories/ingresso.repository');
const mp = load('./src/services/mercadopago.service');
const { migrar } = load('./src/database/migrate');
const als = new AsyncLocalStorage();
const payments = new Map();
let refunds = 0;
mp.obterPagamento = async (id) => {
  assert.ok(payments.has(String(id)));
  return payments.get(String(id));
};
mp.estornarPagamento = async () => {
  refunds++;
  return { status: 'approved' };
};
mp.criarPreferencia = async () => ({ preference_id: 'teste', init_point: 'http://127.0.0.1/pagamento-falso' });
const gate = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const wait = async (p) => {
  let timer;
  try {
    return await Promise.race([
      p,
      new Promise((_, reject) => (timer = setTimeout(() => reject(Error('Barreira nao alcancada')), 10000)))
    ]);
  } finally {
    clearTimeout(timer);
  }
};
const originalGet = db.getConnection.bind(db);
const getConn = () => new Promise((resolve, reject) => originalGet((e, c) => (e ? reject(e) : resolve(c))));
const wrap = (conn, operation) =>
  new Proxy(conn, {
    get(target, key) {
      if (key === 'release') return () => {};
      if (key === 'query')
        return (...args) => {
          const ctx = operation;
          const sql = typeof args[0] === 'string' ? args[0] : args[0]?.sql || '';
          const status = /UPDATE pedidos_ingresso SET status = '(\w+)'/.exec(sql)?.[1];
          if (ctx?.repairAttempt && sql.startsWith('SELECT status FROM pedidos_ingresso')) ctx.repairAttempt.resolve();
          if (ctx?.failEmitAt && /^INSERT INTO ingressos_emitidos/.test(sql.trim()) && ++ctx.emits === ctx.failEmitAt) {
            queueMicrotask(() =>
              args.at(-1)(Object.assign(Error('falha de emissao injetada'), { code: 'AUDIT_FAULT' }))
            );
            return;
          }
          if (ctx?.holdRepair && sql.startsWith('SELECT status FROM pedidos_ingresso')) {
            const callback = args.at(-1);
            args[args.length - 1] = (err, ...rest) => {
              if (err) return callback(err, ...rest);
              ctx.enter.resolve();
              ctx.release.promise.then(() => callback(err, ...rest));
            };
          }
          if (status === 'pago') ctx?.paidAttempt?.resolve();
          if (ctx?.failEmit && /^INSERT INTO ingressos_emitidos/.test(sql.trim())) {
            queueMicrotask(() =>
              args.at(-1)(Object.assign(Error('falha de emissao injetada'), { code: 'AUDIT_FAULT' }))
            );
            return;
          }
          if (ctx?.failCancel && status === 'cancelado') {
            queueMicrotask(() =>
              args.at(-1)(Object.assign(Error('falha de cancelamento injetada'), { code: 'AUDIT_FAULT' }))
            );
            return;
          }
          if (status && ctx?.holdStatus === status) {
            const callback = args.at(-1);
            if (typeof callback !== 'function') throw Error('Callback SQL esperado');
            args[args.length - 1] = (err, ...rest) => {
              if (err) return callback(err, ...rest);
              ctx.enter.resolve();
              ctx.release.promise.then(() => callback(err, ...rest));
            };
          }
          return target.query(...args);
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
db.getConnection = (cb) => {
  const conn = als.getStore()?.conn;
  if (conn) return cb(null, conn);
  return originalGet(cb);
};
const run = (conn, opts, fn) => {
  const ctx = { ...opts };
  ctx.conn = wrap(conn, ctx);
  return als.run(ctx, fn);
};
const results = [];
let admin, a, b;
const evidence = {};
async function clean() {
  for (const t of [
    'ingressos_emitidos',
    'itens_pedido',
    'pedidos_ingresso',
    'lotes_ingresso',
    'cupons',
    'lista_espera',
    'custos_evento',
    'lineup',
    'eventos',
    'bandas',
    'usuarios'
  ])
    await admin.query('DELETE FROM ' + t);
  payments.clear();
  refunds = 0;
}
async function fixture(status = 'pendente', quantidade = 2) {
  const [user] = await admin.execute('INSERT INTO usuarios(email,senha,perfil) VALUES (?,?,?)', [
    `audit.${crypto.randomUUID()}@teste.local`,
    'sem-login',
    'admin'
  ]);
  const [ev] = await admin.execute(
    "INSERT INTO eventos(nome,data,local,criado_por,slug,venda_publicada) VALUES (?, '2099-01-01','Local ficticio',?,?,1)",
    ['Evento de auditoria', user.insertId, 'audit-' + crypto.randomUUID()]
  );
  const [cup] = await admin.execute(
    "INSERT INTO cupons(evento_id,codigo,desconto_percentual,uso_max,uso_atual) VALUES (?,'AUDIT',10,5,1)",
    [ev.insertId]
  );
  const paid = status === 'pago';
  const [lot] = await admin.execute(
    "INSERT INTO lotes_ingresso(evento_id,nome,preco,quantidade_total,quantidade_vendida,quantidade_reservada) VALUES (?,'Lote teste',50,10,?,?)",
    [ev.insertId, paid ? quantidade : 0, paid ? 0 : quantidade]
  );
  const codigo = crypto.randomBytes(8).toString('hex');
  const [order] = await admin.execute(
    "INSERT INTO pedidos_ingresso(evento_id,codigo_publico,nome,email,status,total,expires_at,cupom_id,mp_payment_id) VALUES (?,?, 'Comprador ficticio','comprador@teste.local',?,100,'2000-01-01',?,?)",
    [ev.insertId, codigo, status, cup.insertId, paid ? '500000' : null]
  );
  await admin.execute('INSERT INTO itens_pedido(pedido_id,lote_id,quantidade,preco_unitario) VALUES (?,?,?,50)', [
    order.insertId,
    lot.insertId,
    quantidade
  ]);
  payments.set('10001', {
    external_reference: codigo,
    currency_id: 'BRL',
    transaction_amount: 100,
    status: 'approved'
  });
  return {
    id: order.insertId,
    codigo,
    evento: ev.insertId,
    lote: lot.insertId,
    cupom: cup.insertId,
    user: { id: user.insertId, perfil: 'admin' }
  };
}
async function state(f) {
  const [p] = await admin.execute('SELECT status,mp_payment_id FROM pedidos_ingresso WHERE id=?', [f.id]);
  const [l] = await admin.execute(
    'SELECT quantidade_vendida AS vendida,quantidade_reservada AS reservada FROM lotes_ingresso WHERE id=?',
    [f.lote]
  );
  const [i] = await admin.execute('SELECT id,codigo,status FROM ingressos_emitidos WHERE pedido_id=? ORDER BY id', [
    f.id
  ]);
  const [c] = await admin.execute('SELECT uso_atual FROM cupons WHERE id=?', [f.cupom]);
  const [expected] = await admin.execute(
    "SELECT COALESCE(SUM(CASE WHEN p.status='pendente' THEN ip.quantidade ELSE 0 END),0) AS reservada,COALESCE(SUM(CASE WHEN p.status='pago' THEN ip.quantidade ELSE 0 END),0) AS vendida FROM pedidos_ingresso p JOIN itens_pedido ip ON ip.pedido_id=p.id WHERE ip.lote_id=?",
    [f.lote]
  );
  return { pedido: p[0], lote: l[0], ingressos: i, cupom: c[0]?.uso_atual, refunds, expectedFromOrders: expected[0] };
}
async function test(name, fn) {
  await clean();
  try {
    await fn();
    results.push({ name, pass: true, evidence: evidence[name] });
  } catch (e) {
    results.push({ name, pass: false, error: String(e), evidence: evidence[name] });
  }
  console.log(results.at(-1));
}
async function main() {
  admin = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });
  const [tables] = await admin.query("SHOW TABLES LIKE 'usuarios'");
  if (!tables.length) await admin.query(fs.readFileSync(path.join(base, 'database/schema-cloud.sql'), 'utf8'));
  await migrar();
  await migrar();
  a = await getConn();
  b = await getConn();
  assert.notEqual(a.threadId, b.threadId);
  await test('controle: confirmacoes simultaneas e notificacoes distintas nao duplicam ingressos', async () => {
    const f = await fixture();
    const first = { holdStatus: 'pago', enter: gate(), release: gate() };
    const second = { paidAttempt: gate() };
    const p1 = run(a, first, () => pedido.processarWebhook({ id: 'entrega-1', data: { id: '10001' } }));
    await wait(first.enter.promise);
    const p2 = run(b, second, () => pedido.processarWebhook({ id: 'entrega-2', data: { id: '10001' } }));
    await wait(second.paidAttempt.promise);
    first.release.resolve();
    await Promise.all([p1, p2]);
    const before = await state(f);
    await pedido.processarWebhook({ id: 'entrega-3', data: { id: '10001' } });
    const after = await state(f);
    evidence['controle: confirmacoes simultaneas e notificacoes distintas nao duplicam ingressos'] = after;
    assert.equal(after.pedido.status, 'pago');
    assert.equal(after.ingressos.length, 2);
    assert.deepEqual(after.ingressos, before.ingressos);
    assert.equal(after.lote.vendida, 2);
    assert.equal(after.lote.reservada, 0);
    assert.equal(after.cupom, 1);
  });
  await test('controle: falha entre confirmacao e emissao reverte SQL e reentrega recupera', async () => {
    const f = await fixture();
    await assert.rejects(
      run(a, { failEmit: true }, () => pedido.processarWebhook({ data: { id: '10001' } })),
      /injetada/
    );
    const rollback = await state(f);
    assert.equal(rollback.pedido.status, 'pendente');
    assert.equal(rollback.lote.vendida, 0);
    assert.equal(rollback.lote.reservada, 2);
    assert.equal(rollback.ingressos.length, 0);
    assert.equal(rollback.cupom, 1);
    await run(b, {}, () => pedido.processarWebhook({ data: { id: '10001' } }));
    const after = await state(f);
    evidence['controle: falha entre confirmacao e emissao reverte SQL e reentrega recupera'] = { rollback, after };
    assert.equal(after.ingressos.length, 2);
    assert.equal(after.pedido.status, 'pago');
  });
  await test('controle: confirmacao disputa expiracao com trava real e resgata reserva', async () => {
    const f = await fixture();
    const exp = { holdStatus: 'expirado', enter: gate(), release: gate() };
    const pay = { paidAttempt: gate() };
    const e = run(a, exp, () => pedido.expirarReservas());
    await wait(exp.enter.promise);
    const p = run(b, pay, () => pedido.processarWebhook({ data: { id: '10001' } }));
    await wait(pay.paidAttempt.promise);
    exp.release.resolve();
    await Promise.all([e, p]);
    const after = await state(f);
    evidence['controle: confirmacao disputa expiracao com trava real e resgata reserva'] = after;
    assert.equal(after.pedido.status, 'pago');
    assert.equal(after.ingressos.length, 2);
    assert.equal(after.lote.vendida, 2);
    assert.equal(after.lote.reservada, 0);
    assert.equal(after.cupom, 1);
  });
  await test('B-01: cancelamento iniciado pendente deve lidar com pagamento confirmado no intervalo', async () => {
    const f = await fixture();
    const [other] = await admin.execute(
      "INSERT INTO pedidos_ingresso(evento_id,codigo_publico,nome,email,status,total,expires_at) VALUES (?,?, 'Outro comprador','outro@teste.local','pendente',100,'2099-01-01')",
      [f.evento, crypto.randomBytes(8).toString('hex')]
    );
    await admin.execute('INSERT INTO itens_pedido(pedido_id,lote_id,quantidade,preco_unitario) VALUES (?,?,2,50)', [
      other.insertId,
      f.lote
    ]);
    await admin.execute('UPDATE lotes_ingresso SET quantidade_reservada=4 WHERE id=?', [f.lote]);
    const enter = gate(),
      release = gate();
    const original = repo.buscarItensPedido;
    repo.buscarItensPedido = async (id) => {
      const rows = await original(id);
      if (als.getStore()?.label === 'cancel') {
        enter.resolve();
        await release.promise;
      }
      return rows;
    };
    let cancelResult;
    try {
      const cancel = run(a, { label: 'cancel' }, () => pedido.cancelarPedido(f.evento, f.codigo, f.user)).catch(
        (error) => {
          if (error.status === 409) return { conflict: true };
          throw error;
        }
      );
      await wait(enter.promise);
      await run(b, {}, () => pedido.processarWebhook({ data: { id: '10001' } }));
      release.resolve();
      cancelResult = await cancel;
    } finally {
      repo.buscarItensPedido = original;
      release.resolve();
    }
    const after = await state(f);
    evidence['B-01: cancelamento iniciado pendente deve lidar com pagamento confirmado no intervalo'] = after;
    if (cancelResult?.conflict) {
      assert.equal(after.pedido.status, 'pago');
      assert.equal(after.ingressos.filter((i) => i.status === 'valido').length, 2);
      assert.equal(after.refunds, 0);
    } else {
      assert.equal(after.refunds, 1, 'cancelamento concluido de pagamento confirmado exige estorno');
      assert.equal(after.lote.vendida, 0);
    }
    assert.equal(after.lote.reservada, 2, 'a reserva do outro pedido permanece');
  });
  await test('B-02: reparos simultaneos de pedido pago nao podem emitir em dobro', async () => {
    const f = await fixture('pago');
    const snapshot = await repo.buscarPorId(f.id);
    const first = { holdRepair: true, enter: gate(), release: gate() };
    const second = { repairAttempt: gate() };
    const p1 = run(a, first, () => pedido.confirmarPagamentoPedido(snapshot, '10001'));
    await wait(first.enter.promise);
    const p2 = run(b, second, () => pedido.confirmarPagamentoPedido(snapshot, '10001'));
    await wait(second.repairAttempt.promise);
    first.release.resolve();
    await Promise.all([p1, p2]);
    const after = await state(f);
    evidence['B-02: reparos simultaneos de pedido pago nao podem emitir em dobro'] = after;
    assert.equal(after.ingressos.length, 2);
  });
  await test('B-02b: reparo de pedido pago parcial deve completar unidades faltantes', async () => {
    const f = await fixture('pago');
    await assert.rejects(
      run(a, { failEmitAt: 2, emits: 0 }, () => pedido.confirmarPagamentoPedido({ id: f.id, status: 'pago' }, '10001')),
      /injetada/
    );
    assert.equal((await state(f)).ingressos.length, 0, 'reparo incompleto faz rollback');
    await admin.execute("INSERT INTO ingressos_emitidos(codigo,pedido_id,lote_id) VALUES ('legado-parcial',?,?)", [
      f.id,
      f.lote
    ]);
    await pedido.confirmarPagamentoPedido(await repo.buscarPorId(f.id), '10001');
    const after = await state(f);
    evidence['B-02b: reparo de pedido pago parcial deve completar unidades faltantes'] = after;
    assert.equal(after.ingressos.length, 2);
    assert.ok(after.ingressos.some((i) => i.codigo === 'legado-parcial'));
    await pedido.confirmarPagamentoPedido(await repo.buscarPorId(f.id), '10001');
    assert.deepEqual((await state(f)).ingressos, after.ingressos);
  });
  await test('B-03: estorno externo seguido de falha SQL nao deve deixar ingresso utilizavel', async () => {
    const f = await fixture();
    await pedido.processarWebhook({ data: { id: '10001' } });
    await assert.rejects(
      run(a, { failCancel: true }, () => pedido.cancelarPedido(f.evento, f.codigo, f.user)),
      /injetada/
    );
    const after = await state(f);
    evidence['B-03: estorno externo seguido de falha SQL nao deve deixar ingresso utilizavel'] = after;
    assert.equal(refunds, 1);
    await assert.rejects(
      pedido.obterIngressoPublico(after.ingressos[0].codigo),
      'sem estorno pendente/conciliacao persistida, ingresso segue valido'
    );
  });
  await test('retomada apos falha SQL reutiliza chave persistida e finaliza uma unica vez', async () => {
    const f = await fixture();
    await pedido.processarWebhook({ data: { id: '10001' } });
    const keys = [];
    mp.estornarPagamento = async (id, key) => {
      assert.equal(id, '10001');
      keys.push(key);
      refunds++;
      return { status: 'approved' };
    };
    await assert.rejects(
      run(a, { failCancel: true }, () => pedido.cancelarPedido(f.evento, f.codigo, f.user)),
      /injetada/
    );
    const suspended = await state(f);
    await assert.rejects(
      pedido.recuperarIngresso({ email: 'comprador@teste.local', codigo_pedido: f.codigo }),
      (e) => e.status === 409
    );
    await assert.rejects(pedido.checkin(suspended.ingressos[0].codigo, f.user), (e) => e.status === 409);
    delete require.cache[load.resolve('./src/services/pedido.service')];
    const restarted = load('./src/services/pedido.service');
    assert.equal((await restarted.retomarCancelamentos()).concluidos, 1);
    assert.equal(keys.length, 2);
    assert.equal(keys[0], keys[1]);
    assert.ok(keys[0]);
    const done = await state(f);
    assert.equal(done.pedido.status, 'cancelado');
    assert.equal(done.lote.vendida, 0);
    assert.equal(done.lote.reservada, 0);
    assert.equal(done.cupom, 0);
    assert.ok(done.ingressos.every((i) => i.status === 'cancelado'));
    assert.equal((await restarted.retomarCancelamentos()).concluidos, 0);
    assert.equal(keys.length, 2);
  });
  await test('lease impede dois workers e retoma lease expirada com a mesma chave', async () => {
    const f = await fixture('pago');
    await admin.execute("UPDATE pedidos_ingresso SET mp_payment_id='10001' WHERE id=?", [f.id]);
    const tasks = load('./src/repositories/cancelamento.repository');
    await tasks.preparar(await repo.buscarParaCancelamento(f.id));
    const claimed = await tasks.assumir(f.id);
    await assert.rejects(tasks.assumir(f.id), (e) => e.status === 409);
    assert.equal((await pedido.retomarCancelamentos()).concluidos, 0);
    await admin.execute("UPDATE cancelamentos_ingresso SET lease_ate='2000-01-01' WHERE pedido_id=?", [f.id]);
    const enter = gate(),
      release = gate();
    let calls = 0;
    mp.estornarPagamento = async (id, key) => {
      assert.equal(key, claimed.chave);
      calls++;
      enter.resolve();
      await release.promise;
      return { status: 'approved' };
    };
    const one = pedido.retomarCancelamentos();
    await wait(enter.promise);
    assert.equal((await pedido.retomarCancelamentos()).concluidos, 0);
    release.resolve();
    assert.equal((await one).concluidos, 1);
    assert.equal(calls, 1);
    assert.equal((await state(f)).pedido.status, 'cancelado');
  });
  await test('seed cria admin novo e preserva contas existentes sem promover ou trocar senha', async () => {
    const { seed } = load('./scripts/seed_admin');
    const env = { SEED_ADMIN_EMAIL: 'seed@teste.local', SEED_ADMIN_PASSWORD: 'senha-ficticia-12345' };
    const created = await seed({ env, db });
    assert.equal(created.criado, true);
    const [before] = await admin.execute('SELECT senha,perfil FROM usuarios WHERE id=?', [created.id]);
    assert.equal(before[0].perfil, 'admin');
    assert.ok(await load('bcryptjs').compare(env.SEED_ADMIN_PASSWORD, before[0].senha));
    assert.equal((await seed({ env: { ...env, SEED_ADMIN_PASSWORD: 'outra-senha-ficticia' }, db })).criado, false);
    const [after] = await admin.execute('SELECT senha,perfil FROM usuarios WHERE id=?', [created.id]);
    assert.deepEqual(after, before);
    await admin.execute("UPDATE usuarios SET perfil='produtor' WHERE id=?", [created.id]);
    await assert.rejects(seed({ env, db }), /conta cadastrada/);
    const [producer] = await admin.execute('SELECT senha,perfil FROM usuarios WHERE id=?', [created.id]);
    assert.equal(producer[0].perfil, 'produtor');
    assert.equal(producer[0].senha, before[0].senha);
    for (const password of ['', 'curta', ' '.repeat(12)])
      await assert.rejects(
        seed({
          env: { ...env, SEED_ADMIN_PASSWORD: password },
          db: {
            query() {
              throw Error('SQL nao deveria executar');
            }
          }
        }),
        /12 a 128/
      );
    const race = await Promise.all([
      seed({ env: { ...env, SEED_ADMIN_EMAIL: 'race@teste.local' }, db }),
      seed({ env: { ...env, SEED_ADMIN_EMAIL: 'race@teste.local' }, db })
    ]);
    assert.equal(race.filter((x) => x.criado).length, 1);
    assert.equal(race[0].id, race[1].id);
  });
  await clean();
  a.release();
  b.release();
  await new Promise((resolve, reject) => db.end((e) => (e ? reject(e) : resolve())));
  await admin.end();
  console.log(
    JSON.stringify({
      tests: results.length,
      pass: results.filter((x) => x.pass).length,
      fail: results.filter((x) => !x.pass).length
    })
  );
  if (results.some((x) => !x.pass)) process.exitCode = 1;
}
main().catch(async (e) => {
  console.error(e);
  process.exitCode = 2;
  try {
    a?.destroy();
    b?.destroy();
    db.end();
    await admin?.end();
  } catch {}
});
