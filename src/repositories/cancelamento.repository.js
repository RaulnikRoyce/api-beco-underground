const crypto = require('crypto');
const db = require('../database/db');
const { AppError } = require('../utils/erros');

const query = (sql, params = []) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

exports.preparar = (pedido) => db.comTransacao(async (exec) => {
    const rows = await exec('SELECT status, mp_payment_id FROM pedidos_ingresso WHERE id = ? FOR UPDATE', [pedido.id]);
    if (rows[0]?.status !== 'pago' || String(rows[0].mp_payment_id) !== String(pedido.mp_payment_id)) {
        throw new AppError(409, 'O pedido mudou. Atualize antes de cancelar.');
    }
    await exec(`INSERT INTO cancelamentos_ingresso (pedido_id, payment_id, chave)
        VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE pedido_id = pedido_id`,
    [pedido.id, String(pedido.mp_payment_id), crypto.randomUUID()]);
});

exports.assumir = async (pedidoId) => {
    const token = crypto.randomUUID();
    const result = await query(`UPDATE cancelamentos_ingresso SET lease_token = ?, lease_ate = ?, tentativas = tentativas + 1
        WHERE pedido_id = ? AND status = 'pendente' AND (lease_ate IS NULL OR lease_ate < ?)`,
    [token, new Date(Date.now() + 120000), pedidoId, new Date()]);
    if (!result.affectedRows) throw new AppError(409, 'Cancelamento já em processamento. Atualize em instantes.');
    const rows = await query('SELECT * FROM cancelamentos_ingresso WHERE pedido_id = ? AND lease_token = ?', [pedidoId, token]);
    return rows[0];
};
exports.liberar = (tarefa, erro) => query(`UPDATE cancelamentos_ingresso SET lease_token = NULL, lease_ate = NULL, ultimo_erro = ?
    WHERE pedido_id = ? AND lease_token = ? AND status = 'pendente'`,
[String(erro.message).slice(0, 500), tarefa.pedido_id, tarefa.lease_token]);
exports.concluir = (exec, tarefa) => exec(`UPDATE cancelamentos_ingresso SET status = 'concluido', lease_token = NULL, lease_ate = NULL, ultimo_erro = NULL
    WHERE pedido_id = ? AND lease_token = ?`, [tarefa.pedido_id, tarefa.lease_token]);
exports.pendentes = () => query(`SELECT pedido_id FROM cancelamentos_ingresso
    WHERE status = 'pendente' AND (lease_ate IS NULL OR lease_ate < ?) ORDER BY pedido_id LIMIT 20`, [new Date()]);
