const db = require('../database/db');

exports.buscarPorEvento = (evento_id) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT l.id AS lineup_id, b.nome, b.genero, l.horario, 
                   COALESCE(l.cache_negociado, b.cache_base) AS cache
            FROM lineup l
            JOIN bandas b ON l.banda_id = b.id
            WHERE l.evento_id = ?
            ORDER BY l.horario ASC
        `;
        db.query(sql, [evento_id], (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};

exports.adicionar = (dados) => {
    return new Promise((resolve, reject) => {
        const { evento_id, banda_id, horario, cache_negociado } = dados;
        const cacheFinal = cache_negociado || null;
        db.query('INSERT INTO lineup (evento_id, banda_id, horario, cache_negociado) VALUES (?, ?, ?, ?)', 
        [evento_id, banda_id, horario, cacheFinal], (err, results) => {
            if (err) return reject(err);
            resolve({ id: results.insertId, ...dados });
        });
    });
};