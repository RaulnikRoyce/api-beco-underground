const assert = require('node:assert/strict'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { createRequire } = require('node:module');
const base = path.resolve(__dirname, '../..'),
  load = createRequire(path.join(base, 'package.json'));
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
  MP_ACCESS_TOKEN: '',
  MP_WEBHOOK_SECRET: ''
});
const app = load('./src/app'),
  db = load('./src/database/db'),
  jwt = load('jsonwebtoken'),
  mp = load('./src/services/mercadopago.service');
const mysql = load('mysql2/promise');
const nativeFetch = global.fetch;
global.fetch = (url, opts) => {
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1') throw Error('Rede externa bloqueada');
  return nativeFetch(url, opts);
};
const results = [];
let conn, server, origin, evidence;
async function test(name, fn) {
  try {
    evidence = undefined;
    await fn();
    results.push({ name, pass: true, evidence });
  } catch (e) {
    results.push({ name, pass: false, error: String(e), evidence });
  }
  console.log(results.at(-1));
}
async function clean() {
  for (const table of [
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
    await conn.query('DELETE FROM ' + table);
}
async function main() {
  conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  await clean();
  const users = [];
  for (const perfil of ['produtor', 'produtor', 'admin']) {
    const [r] = await conn.execute('INSERT INTO usuarios(email,senha,perfil) VALUES (?,?,?)', [
      crypto.randomUUID() + '@teste.local',
      'sem-login',
      perfil
    ]);
    users.push({
      id: r.insertId,
      perfil,
      token: jwt.sign({ id: r.insertId, perfil }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' })
    });
  }
  const [a, b, admin] = users;
  const events = [];
  for (let i = 0; i < 25; i++) {
    const [e] = await conn.execute(
      "INSERT INTO eventos(nome,data,local,criado_por,slug,venda_publicada) VALUES (?,'2099-01-01','Local ficticio',?,?,1)",
      [i === 24 ? 'Evento B' : 'Mesmo nome', i === 24 ? b.id : a.id, 'audit-' + crypto.randomUUID()]
    );
    events.push(e.insertId);
  }
  const ev = events[0];
  await conn.execute('UPDATE eventos SET nome=? WHERE id=?', ['<strong>Ana</strong>', events[23]]);
  const [band] = await conn.execute("INSERT INTO bandas(nome,cache_base) VALUES ('Banda A',999)");
  const [band2] = await conn.execute("INSERT INTO bandas(nome,cache_base) VALUES ('Banda B',888)");
  const secret = crypto.randomBytes(16).toString('hex');
  await conn.execute(
    "INSERT INTO lineup(evento_id,banda_id,horario,cache_negociado,token_publico) VALUES (?,?,'21:00',100,?)",
    [ev, band.insertId, secret]
  );
  await conn.execute(
    "INSERT INTO lineup(evento_id,banda_id,horario,cache_negociado,token_publico) VALUES (?,?,'22:00',200,?)",
    [ev, band2.insertId, crypto.randomBytes(16).toString('hex')]
  );
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  origin = 'http://127.0.0.1:' + server.address().port;
  const request = async (method, route, token, body, extra = {}) => {
    const r = await fetch(origin + route, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: r.status, body: await r.json() };
  };
  await test('controle: produtor B nao le altera ou exclui evento de A', async () => {
    const statuses = [];
    for (const method of ['GET', 'PATCH', 'DELETE'])
      statuses.push(
        (await request(method, '/eventos/' + ev, b.token, method === 'PATCH' ? { nome: 'alterado' } : undefined)).status
      );
    assert.deepEqual(statuses, [403, 403, 403]);
    assert.equal((await request('GET', '/eventos/' + ev, a.token)).status, 200);
    const list = await request('GET', '/eventos', b.token);
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].criado_por, b.id);
    evidence = { statuses, visible: list.body.map((x) => x.id) };
  });
  await test('controle: perfil do banco prevalece sobre JWT forjado como admin e conta bloqueada perde acesso', async () => {
    const fake = jwt.sign({ id: a.id, perfil: 'admin' }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '5m'
    });
    assert.equal((await request('GET', `/eventos/${ev}/ingressos/compradores`, fake)).status, 403);
    await conn.execute('UPDATE usuarios SET ativo=0 WHERE id=?', [a.id]);
    assert.equal((await request('GET', '/eventos', a.token)).status, 401);
    await conn.execute('UPDATE usuarios SET ativo=1 WHERE id=?', [a.id]);
    evidence = { adminClaimIgnored: true, inactiveDenied: true };
  });
  await test('controle: busca parametrizada nao altera filtro de dono; paginacao invalida e recusada', async () => {
    const search = await request('GET', '/eventos?q=' + encodeURIComponent("%' OR 1=1 --"), a.token);
    assert.equal(search.status, 200);
    assert.equal(search.body.length, 0);
    for (const query of ['page=0', 'page=1.5', 'page=1&limit=-2'])
      assert.equal((await request('GET', '/eventos?' + query, a.token)).status, 400);
    evidence = { parameterized: true, badPagesDenied: true };
  });
  await test('controle: link da banda expoe cache proprio sem revelar o cache alheio', async () => {
    const page = await request('GET', '/publico/' + secret);
    assert.equal(page.status, 200);
    assert.equal(page.body.voce.cache, 100);
    assert.equal(page.body.lineup.length, 2);
    assert.ok(
      page.body.lineup.every((row) => !('cache' in row) && !('cache_base' in row) && !('token_publico' in row))
    );
    evidence = page.body;
  });
  await test('B-05: paginas ordenadas por nome com empates devem preservar unicidade', async () => {
    const pages = [];
    for (let page = 1; page <= 8; page++) {
      const r = await request('GET', `/eventos?page=${page}&limit=3&ordenar=nome`, a.token);
      assert.equal(r.status, 200);
      pages.push(r.body.dados.map((e) => e.id));
    }
    const ids = pages.flat();
    evidence = { pages, total: ids.length, unique: new Set(ids).size };
    assert.equal(ids.length, 24);
    assert.equal(new Set(ids).size, 24);
  });
  await test('controle: valor e moeda divergentes nao confirmam pagamento', async () => {
    const [lot] = await conn.execute(
      "INSERT INTO lotes_ingresso(evento_id,nome,preco,quantidade_total,quantidade_reservada) VALUES (?,'Lote',50,10,1)",
      [ev]
    );
    const code = crypto.randomBytes(8).toString('hex');
    const [order] = await conn.execute(
      "INSERT INTO pedidos_ingresso(evento_id,codigo_publico,nome,email,total,status) VALUES (?,?,'Pessoa','ficticio@teste.local',50,'pendente')",
      [ev, code]
    );
    await conn.execute('INSERT INTO itens_pedido(pedido_id,lote_id,quantidade,preco_unitario) VALUES (?,?,1,50)', [
      order.insertId,
      lot.insertId
    ]);
    for (const mismatch of [
      { currency_id: 'USD', transaction_amount: 50 },
      { currency_id: 'BRL', transaction_amount: 1 }
    ]) {
      mp.obterPagamento = async () => ({ ...mismatch, status: 'approved', external_reference: code });
      assert.equal((await request('POST', '/ingressos/webhook', undefined, { data: { id: '10001' } })).status, 400);
    }
    const [rows] = await conn.execute('SELECT status FROM pedidos_ingresso WHERE id=?', [order.insertId]);
    assert.equal(rows[0].status, 'pendente');
    evidence = { mismatchesDenied: true };
  });
  await test('B-06: assinatura deve corresponder ao ID de pagamento efetivamente processado', async () => {
    const fetched = [];
    mp.obterPagamento = async (id) => {
      fetched.push(id);
      return { external_reference: null };
    };
    process.env.MP_WEBHOOK_SECRET = 'secret-apenas-auditoria';
    const id = '10001',
      bodyId = '10002',
      requestId = 'audit-request',
      ts = String(Date.now());
    const hash = crypto
      .createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
      .update(`id:${id};request-id:${requestId};ts:${ts};`)
      .digest('hex');
    const response = await request(
      'POST',
      '/ingressos/webhook?data.id=' + id,
      undefined,
      { data: { id: bodyId } },
      { 'x-signature': `ts=${ts},v1=${hash}`, 'x-request-id': requestId }
    );
    evidence = { status: response.status, signedId: id, bodyId, fetched };
    assert.ok([400, 401].includes(response.status), 'IDs divergentes devem ser recusados antes da consulta');
    assert.deepEqual(fetched, []);
    process.env.MP_WEBHOOK_SECRET = '';
  });
  await clean();
  await new Promise((r) => server.close(r));
  await new Promise((r, j) => db.end((e) => (e ? j(e) : r())));
  await conn.end();
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
  server?.close();
  db.end();
  await conn?.end();
});
