const db = require('../database/db');

exports.buscarPorCodigo = (eventoId, codigo) => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, evento_id, codigo, desconto_percentual, uso_max, uso_atual, ativo
         FROM cupons WHERE evento_id = ? AND codigo = ? AND ativo = 1`,
        [eventoId, codigo],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0]);
        }
    );
});

exports.reservarUso = (exec, cupomId) =>
    exec(
        `UPDATE cupons SET uso_atual = uso_atual + 1
         WHERE id = ? AND (uso_max IS NULL OR uso_atual < uso_max)`,
        [cupomId]
    ).then((result) => {
        if (!result.affectedRows) throw new Error('CUPOM_ESGOTADO');
        return result;
    });

exports.liberarUso = (exec, cupomId) =>
    exec(
        'UPDATE cupons SET uso_atual = GREATEST(0, uso_atual - 1) WHERE id = ?',
        [cupomId]
    );

exports.listarPorEvento = (eventoId) => new Promise((resolve, reject) => {
    db.query(
        'SELECT id, codigo, desconto_percentual, uso_max, uso_atual, ativo FROM cupons WHERE evento_id = ?',
        [eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        }
    );
});

exports.criar = ({ evento_id, codigo, desconto_percentual, uso_max }) => new Promise((resolve, reject) => {
    db.query(
        'INSERT INTO cupons (evento_id, codigo, desconto_percentual, uso_max) VALUES (?, ?, ?, ?)',
        [evento_id, codigo.toUpperCase(), desconto_percentual, uso_max || null],
        (err, result) => {
            if (err) return reject(err);
            resolve({ id: result.insertId, codigo: codigo.toUpperCase() });
        }
    );
});
