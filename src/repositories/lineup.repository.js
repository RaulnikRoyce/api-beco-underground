const db = require('../database/db');

const SELECT_LINEUP = `
    SELECT
        l.id AS lineup_id,
        l.evento_id,
        b.nome AS nome,
        TIME_FORMAT(l.horario, '%H:%i') AS horario,
        COALESCE(l.cache_negociado, b.cache_base) AS cache
    FROM lineup l
    JOIN bandas b ON l.banda_id = b.id
`;

exports.salvar = (evento_id, banda_id, horario, cache_negociado) => new Promise((resolve, reject) => {
    const sql = 'INSERT INTO lineup (evento_id, banda_id, horario, cache_negociado) VALUES (?, ?, ?, ?)';
    db.query(sql, [evento_id, banda_id, horario ?? null, cache_negociado ?? null], (err, result) => {
        if (err) return reject(err);
        resolve({ id: result.insertId, evento_id, banda_id, horario, cache_negociado });
    });
});

exports.buscarPorEvento = (evento_id) => new Promise((resolve, reject) => {
    const sql = `${SELECT_LINEUP} WHERE l.evento_id = ? ORDER BY l.horario ASC, b.nome ASC`;
    db.query(sql, [evento_id], (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados);
    });
});

exports.buscarPorEventos = (ids) => new Promise((resolve, reject) => {
    if (!ids.length) return resolve([]);

    const placeholders = ids.map(() => '?').join(',');
    const sql = `${SELECT_LINEUP} WHERE l.evento_id IN (${placeholders}) ORDER BY l.horario ASC, b.nome ASC`;

    db.query(sql, ids, (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados);
    });
});
