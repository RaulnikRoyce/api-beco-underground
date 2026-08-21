const db = require('../database/db');
const { gerarTokenPublico } = require('../utils/token.publico');

const ORDER_PALCO = `
    CASE WHEN l.horario IS NULL THEN 1 ELSE 0 END,
    CASE WHEN HOUR(l.horario) < 12 THEN 1 ELSE 0 END,
    l.horario ASC,
    b.nome ASC
`;

const SELECT_LINEUP = `
    SELECT
        l.id AS lineup_id,
        l.evento_id,
        l.banda_id,
        l.token_publico AS token,
        b.nome AS nome,
        TIME_FORMAT(l.horario, '%H:%i') AS horario,
        COALESCE(l.cache_negociado, b.cache_base) AS cache
    FROM lineup l
    JOIN bandas b ON l.banda_id = b.id
`;

const SELECT_SLOT_PUBLICO = `
    SELECT
        l.id AS lineup_id,
        l.evento_id,
        b.nome AS nome,
        TIME_FORMAT(l.horario, '%H:%i') AS horario,
        COALESCE(l.cache_negociado, b.cache_base) AS cache,
        e.nome AS evento_nome,
        DATE_FORMAT(e.data, '%Y-%m-%d') AS evento_data,
        e.local AS evento_local
    FROM lineup l
    JOIN bandas b ON l.banda_id = b.id
    JOIN eventos e ON e.id = l.evento_id
    WHERE l.token_publico = ?
`;

exports.salvar = (evento_id, banda_id, horario, cache_negociado) => new Promise((resolve, reject) => {
    const token_publico = gerarTokenPublico();
    const sql = 'INSERT INTO lineup (evento_id, banda_id, horario, cache_negociado, token_publico) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [evento_id, banda_id, horario ?? null, cache_negociado ?? null, token_publico], (err, result) => {
        if (err) return reject(err);
        resolve({ id: result.insertId, evento_id, banda_id, horario, cache_negociado, token: token_publico });
    });
});

exports.buscarPorEvento = (evento_id) => new Promise((resolve, reject) => {
    const sql = `${SELECT_LINEUP} WHERE l.evento_id = ? ORDER BY ${ORDER_PALCO}`;
    db.query(sql, [evento_id], (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados);
    });
});

exports.buscarPorEventos = (ids) => new Promise((resolve, reject) => {
    if (!ids.length) return resolve([]);

    const placeholders = ids.map(() => '?').join(',');
    const sql = `${SELECT_LINEUP} WHERE l.evento_id IN (${placeholders}) ORDER BY ${ORDER_PALCO}`;

    db.query(sql, ids, (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados);
    });
});

exports.buscarPorToken = (token) => new Promise((resolve, reject) => {
    db.query(SELECT_SLOT_PUBLICO, [token], (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados[0] || null);
    });
});

exports.buscarPorId = (id) => new Promise((resolve, reject) => {
    db.query(`${SELECT_LINEUP} WHERE l.id = ?`, [id], (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados[0] || null);
    });
});

exports.atualizar = (id, dados) => new Promise((resolve, reject) => {
    const campos = [];
    const params = [];

    if (dados.horario !== undefined) {
        campos.push('horario = ?');
        params.push(dados.horario);
    }
    if (dados.cache_negociado !== undefined) {
        campos.push('cache_negociado = ?');
        params.push(dados.cache_negociado);
    }

    if (!campos.length) return resolve(null);

    params.push(id);
    db.query(`UPDATE lineup SET ${campos.join(', ')} WHERE id = ?`, params, (err, result) => {
        if (err) return reject(err);
        if (!result.affectedRows) return resolve(null);
        exports.buscarPorId(id).then(resolve).catch(reject);
    });
});

exports.excluir = (id) => new Promise((resolve, reject) => {
    db.query('DELETE FROM lineup WHERE id = ?', [id], (err, result) => {
        if (err) return reject(err);
        resolve(result.affectedRows > 0);
    });
});
