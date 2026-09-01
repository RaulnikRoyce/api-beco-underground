const db = require('../database/db');

exports.buscarPorCodigo = (codigo) => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, evento_id, codigo_publico, nome, email, status, canal,
                mp_payment_id, total, taxa_estimada, expires_at, criado_em,
                desconto_aplicado, cupom_id
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

exports.atualizarMpPaymentId = (pedidoId, mpPaymentId) => new Promise((resolve, reject) => {
    db.query(
        'UPDATE pedidos_ingresso SET mp_payment_id = ? WHERE id = ?',
        [mpPaymentId, pedidoId],
        (err) => {
            if (err) return reject(err);
            resolve(true);
        }
    );
});

exports.marcarPago = (pedidoId, mpPaymentId) => new Promise((resolve, reject) => {
    db.query(
        `UPDATE pedidos_ingresso SET status = 'pago', mp_payment_id = COALESCE(?, mp_payment_id)
         WHERE id = ? AND status = 'pendente'`,
        [mpPaymentId, pedidoId],
        (err, result) => {
            if (err) return reject(err);
            resolve(result.affectedRows > 0);
        }
    );
});

exports.marcarExpirado = (pedidoId) => new Promise((resolve, reject) => {
    db.query(
        `UPDATE pedidos_ingresso SET status = 'expirado'
         WHERE id = ? AND status = 'pendente'`,
        [pedidoId],
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
        `SELECT id, evento_id FROM pedidos_ingresso
         WHERE status = 'pendente' AND expires_at IS NOT NULL AND expires_at < NOW()`,
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
        `UPDATE ingressos_emitidos SET status = 'usado', usado_em = NOW(), usado_por = ?
         WHERE codigo = ? AND status = 'valido'`,
        [adminId, codigo],
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

exports.confirmarVendaLote = (exec, loteId, quantidade) =>
    exec(
        `UPDATE lotes_ingresso
         SET quantidade_vendida = quantidade_vendida + ?,
             quantidade_reservada = GREATEST(0, quantidade_reservada - ?)
         WHERE id = ?`,
        [quantidade, quantidade, loteId]
    );

exports.devolverVendaLote = (loteId, quantidade) => new Promise((resolve, reject) => {
    db.query(
        `UPDATE lotes_ingresso
         SET quantidade_vendida = GREATEST(0, quantidade_vendida - ?)
         WHERE id = ?`,
        [quantidade, loteId],
        (err) => (err ? reject(err) : resolve(true))
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
                mp_payment_id, total, taxa_estimada, expires_at, criado_em
         FROM pedidos_ingresso WHERE codigo_publico = ? AND evento_id = ?`,
        [codigo, eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0]);
        }
    );
});

exports.marcarCancelado = (pedidoId) => new Promise((resolve, reject) => {
    db.query(
        `UPDATE pedidos_ingresso SET status = 'cancelado'
         WHERE id = ? AND status IN ('pendente', 'pago')`,
        [pedidoId],
        (err, result) => {
            if (err) return reject(err);
            resolve(result.affectedRows > 0);
        }
    );
});

exports.cancelarIngressosDoPedido = (pedidoId) => new Promise((resolve, reject) => {
    db.query(
        `UPDATE ingressos_emitidos SET status = 'cancelado'
         WHERE pedido_id = ? AND status IN ('valido', 'usado')`,
        [pedidoId],
        (err, result) => {
            if (err) return reject(err);
            resolve(result.affectedRows);
        }
    );
});

exports.limparVinculosLoteInativos = (loteId) => new Promise((resolve, reject) => {
    db.query(
        `DELETE ie FROM ingressos_emitidos ie
         JOIN pedidos_ingresso p ON p.id = ie.pedido_id
         WHERE ie.lote_id = ? AND p.status IN ('cancelado', 'expirado')`,
        [loteId],
        (err) => {
            if (err) return reject(err);
            db.query(
                `DELETE ip FROM itens_pedido ip
                 JOIN pedidos_ingresso p ON p.id = ip.pedido_id
                 WHERE ip.lote_id = ? AND p.status IN ('cancelado', 'expirado')`,
                [loteId],
                (err2) => (err2 ? reject(err2) : resolve(true))
            );
        }
    );
});
