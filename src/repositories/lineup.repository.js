// src/repositories/lineup.repository.js
const db = require('../database/db');

exports.salvar = (evento_id, banda_id, horario, cache_negociado) => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO lineup (evento_id, banda_id, horario, cache_negociado) VALUES (?, ?, ?, ?)`;
        db.query(sql, [evento_id, banda_id, horario, cache_negociado], (err, result) => {
            if (err) return reject(err);
            resolve({ id: result.insertId, evento_id, banda_id, horario, cache_negociado });
        });
    });
};

exports.buscarPorEvento = (evento_id) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT l.id, b.nome AS banda, l.horario, COALESCE(l.cache_negociado, b.cache_base) AS cache 
            FROM lineup l
            JOIN bandas b ON l.banda_id = b.id
            WHERE l.evento_id = ?
            ORDER BY l.horario ASC
        `;
        db.query(sql, [evento_id], (err, resultados) => {
            if (err) return reject(err);
            resolve(resultados);
        });
    });
};