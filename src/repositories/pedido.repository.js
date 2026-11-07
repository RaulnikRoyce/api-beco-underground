const db = require('../database/db');

exports.buscarPorCodigo = (codigo) => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, evento_id, codigo_publico, nome, email, status, canal,
                mp_payment_id, mp_preference_id, total, taxa_estimada, expires_at, criado_em,
                desconto_aplicado, cupom_id, pagamento_recusado_em, mp_init_point,
                EXISTS(SELECT 1 FROM cancelamentos_ingresso c WHERE c.pedido_id=pedidos_ingresso.id AND c.status='pendente') AS cancelamento_pendente
         FROM pedidos_ingresso WHERE codigo_publico = ?`,
        [codigo],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0]);
        }
    );
});

exports.buscarPorId = (id) => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, evento_id, codigo_publico, nome, email, status, canal,
                mp_payment_id, total, taxa_estimada, expires_at, criado_em
         FROM pedidos_ingresso WHERE id = ?`,
        [id],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0]);
        }
    );
});

exports.criarPedidoPendente = (dados) => new Promise((resolve, reject) => {
    db.query(
        `INSERT INTO pedidos_ingresso
         (evento_id, codigo_publico, nome, email, status, canal, total, taxa_estimada, expires_at, cupom_id, desconto_aplicado)
         VALUES (?, ?, ?, ?, 'pendente', 'site', ?, ?, ?, ?, ?)`,
        [
            dados.evento_id,
            dados.codigo_publico,
            dados.nome,
            dados.email,
            dados.total,
            dados.taxa_estimada || null,
            dados.expires_at,
            dados.cupom_id || null,
            dados.desconto_aplicado || 0
        ],
        (err, result) => {
            if (err) return reject(err);
            resolve(result.insertId);
        }
    );
});

exports.salvarPreferenciaCriada = (pedidoId, { preferenceId, initPoint }) => new Promise((resolve, reject) => {
    db.query(
        'UPDATE pedidos_ingresso SET mp_preference_id = ?, mp_init_point = ? WHERE id = ?',
        [preferenceId, initPoint, pedidoId],
        (err) => {
            if (err) return reject(err);
            resolve(true);
        }
    );
});

exports.marcarPagamentoRecusado = (pedidoId) => new Promise((resolve, reject) => {
    db.query(
        `UPDATE pedidos_ingresso SET pagamento_recusado_em = ?
         WHERE id = ? AND status = 'pendente'`,
        [new Date(), pedidoId],
        (err, result) => {
            if (err) return reject(err);
            resolve(result.affectedRows > 0);
        }
    );
});

exports.buscarItensPedido = (pedidoId) => new Promise((resolve, reject) => {
    db.query(
        `SELECT ip.id, ip.pedido_id, ip.lote_id, ip.quantidade, ip.preco_unitario, l.nome AS lote_nome
         FROM itens_pedido ip
         JOIN lotes_ingresso l ON ip.lote_id = l.id
         WHERE ip.pedido_id = ?`,
        [pedidoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        }
    );
});

exports.contarIngressosPorEmail = (eventoId, email) => new Promise((resolve, reject) => {
    db.query(
        `SELECT COALESCE(SUM(ip.quantidade), 0) AS total
         FROM pedidos_ingresso p
         JOIN itens_pedido ip ON ip.pedido_id = p.id
         WHERE p.evento_id = ? AND LOWER(p.email) = LOWER(?)
           AND p.status IN ('pendente', 'pago')`,
        [eventoId, email],
        (err, rows) => {
            if (err) return reject(err);
            resolve(Number(rows[0].total) || 0);
        }
    );
});

exports.contarIngressosPorEmailTx = (exec, eventoId, email) =>
    exec(
        `SELECT COALESCE(SUM(ip.quantidade), 0) AS total
         FROM pedidos_ingresso p
         JOIN itens_pedido ip ON ip.pedido_id = p.id
         WHERE p.evento_id = ? AND LOWER(p.email) = LOWER(?)
           AND p.status IN ('pendente', 'pago')
         FOR UPDATE`,
        [eventoId, email]
    ).then((rows) => Number(rows[0]?.total) || 0);

exports.listarCompradores = (eventoId, filtros = {}) => new Promise((resolve, reject) => {
    const params = [eventoId];
    let sql = `
        SELECT p.id, p.codigo_publico, p.nome, p.email, p.status, p.canal, p.total,
               p.criado_em, l.nome AS lote_nome, ip.quantidade
        FROM pedidos_ingresso p
        JOIN itens_pedido ip ON ip.pedido_id = p.id
        JOIN lotes_ingresso l ON ip.lote_id = l.id
        WHERE p.evento_id = ?
    `;

    if (filtros.status) {
        sql += ' AND p.status = ?';
        params.push(filtros.status);
    }
    if (filtros.canal) {
        sql += ' AND p.canal = ?';
        params.push(filtros.canal);
    }
    if (filtros.lote_id) {
        sql += ' AND ip.lote_id = ?';
        params.push(filtros.lote_id);
    }

    sql += ' ORDER BY p.criado_em DESC';

    db.query(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
    });
});

exports.listarPedidosExpirados = () => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, evento_id, cupom_id FROM pedidos_ingresso
         WHERE status = 'pendente' AND expires_at IS NOT NULL AND expires_at < ?`,
        [new Date()],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        }
    );
});

exports.buscarIngressoPorCodigo = (codigo) => new Promise((resolve, reject) => {
    db.query(
        `SELECT ie.id, ie.codigo, ie.status, ie.usado_em, ie.pedido_id, ie.lote_id,
                p.evento_id, p.nome AS comprador_nome, p.email, p.status AS pedido_status,
                EXISTS(SELECT 1 FROM cancelamentos_ingresso c WHERE c.pedido_id=p.id AND c.status='pendente') AS cancelamento_pendente,
                l.nome AS lote_nome, e.nome AS evento_nome,
                DATE_FORMAT(e.data, '%Y-%m-%d') AS evento_data, e.local AS evento_local
         FROM ingressos_emitidos ie
         JOIN pedidos_ingresso p ON ie.pedido_id = p.id
         JOIN lotes_ingresso l ON ie.lote_id = l.id
         JOIN eventos e ON p.evento_id = e.id
         WHERE ie.codigo = ?`,
        [codigo],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0]);
        }
    );
});

exports.marcarIngressoUsado = (codigo, adminId) => new Promise((resolve, reject) => {
    db.query(
        `UPDATE ingressos_emitidos ie JOIN pedidos_ingresso p ON p.id=ie.pedido_id
         SET ie.status = 'usado', ie.usado_em = ?, ie.usado_por = ?
         WHERE ie.codigo = ? AND ie.status = 'valido' AND p.status='pago'
         AND NOT EXISTS (SELECT 1 FROM cancelamentos_ingresso c WHERE c.pedido_id=p.id AND c.status='pendente')`,
        [new Date(), adminId, codigo],
        (err, result) => {
            if (err) return reject(err);
            resolve(result.affectedRows > 0);
        }
    );
});

exports.contarIngressosUsados = (eventoId) => new Promise((resolve, reject) => {
    db.query(
        `SELECT COUNT(ie.id) AS total
         FROM ingressos_emitidos ie
         JOIN pedidos_ingresso p ON ie.pedido_id = p.id
         WHERE p.evento_id = ? AND ie.status = 'usado'`,
        [eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(Number(rows[0].total) || 0);
        }
    );
});

exports.reservarLote = (exec, loteId, quantidade) =>
    exec(
        `UPDATE lotes_ingresso
         SET quantidade_reservada = quantidade_reservada + ?
         WHERE id = ? AND (quantidade_total - quantidade_vendida - quantidade_reservada) >= ?`,
        [quantidade, loteId, quantidade]
    ).then((result) => {
        if (!result.affectedRows) throw new Error('ESTOQUE_INSUFICIENTE');
        return result;
    });

exports.liberarReservaLote = (exec, loteId, quantidade) =>
    exec(
        `UPDATE lotes_ingresso
         SET quantidade_reservada = GREATEST(0, quantidade_reservada - ?)
         WHERE id = ?`,
        [quantidade, loteId]
    );

exports.venderDiretoLote = (exec, loteId, quantidade) =>
    exec(
        `UPDATE lotes_ingresso
         SET quantidade_vendida = quantidade_vendida + ?
         WHERE id = ? AND (quantidade_total - quantidade_vendida - quantidade_reservada) >= ?`,
        [quantidade, loteId, quantidade]
    ).then((result) => {
        if (!result.affectedRows) throw new Error('ESTOQUE_INSUFICIENTE');
        return result;
    });

exports.confirmarVendaLote = (exec, loteId, quantidade) =>
    exec(
        `UPDATE lotes_ingresso
         SET quantidade_vendida = quantidade_vendida + ?,
             quantidade_reservada = GREATEST(0, quantidade_reservada - ?)
         WHERE id = ?`,
        [quantidade, quantidade, loteId]
    );

exports.devolverVendaLote = (exec, loteId, quantidade) =>
    exec(
        `UPDATE lotes_ingresso
         SET quantidade_vendida = GREATEST(0, quantidade_vendida - ?)
         WHERE id = ?`,
        [quantidade, loteId]
    );

exports.contarPedidosPagosPorEvento = (eventoId) => new Promise((resolve, reject) => {
    db.query(
        `SELECT COUNT(*) AS total FROM pedidos_ingresso WHERE evento_id = ? AND status = 'pago'`,
        [eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(Number(rows[0].total) || 0);
        }
    );
});

exports.contarPedidosAtivosPorLote = (loteId) => new Promise((resolve, reject) => {
    db.query(
        `SELECT COUNT(DISTINCT p.id) AS total
         FROM pedidos_ingresso p
         JOIN itens_pedido ip ON ip.pedido_id = p.id
         WHERE ip.lote_id = ? AND p.status IN ('pendente', 'pago')`,
        [loteId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(Number(rows[0].total) || 0);
        }
    );
});

exports.buscarPorCodigoEEvento = (codigo, eventoId) => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, evento_id, codigo_publico, nome, email, status, canal,
                mp_payment_id, total, taxa_estimada, expires_at, criado_em, cupom_id
         FROM pedidos_ingresso WHERE codigo_publico = ? AND evento_id = ?`,
        [codigo, eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0]);
        }
    );
});

exports.marcarCancelado = (exec, pedidoId, statusAnterior) =>
    exec(
        `UPDATE pedidos_ingresso SET status = 'cancelado'
         WHERE id = ? AND status = ?`,
        [pedidoId, statusAnterior]
    ).then((result) => result.affectedRows > 0);

exports.cancelarIngressosDoPedido = (exec, pedidoId) =>
    exec(
        `UPDATE ingressos_emitidos SET status = 'cancelado'
         WHERE pedido_id = ? AND status IN ('valido', 'usado')`,
        [pedidoId]
    ).then((result) => result.affectedRows);

exports.limparVinculosLoteInativos = (loteId) => db.comTransacao(async (exec) => {
    await exec(
        `DELETE ie FROM ingressos_emitidos ie
         JOIN pedidos_ingresso p ON p.id = ie.pedido_id
         WHERE ie.lote_id = ? AND p.status IN ('cancelado', 'expirado')`,
        [loteId]
    );
    await exec(
        `DELETE ip FROM itens_pedido ip
         JOIN pedidos_ingresso p ON p.id = ip.pedido_id
         WHERE ip.lote_id = ? AND p.status IN ('cancelado', 'expirado')`,
        [loteId]
    );
    return true;
});

exports.buscarParaCancelamento = (pedidoId) => new Promise((resolve, reject) => {
    db.query('SELECT id, evento_id, codigo_publico, status, mp_payment_id, cupom_id FROM pedidos_ingresso WHERE id = ?',
        [pedidoId], (err, rows) => err ? reject(err) : resolve(rows[0]));
});
