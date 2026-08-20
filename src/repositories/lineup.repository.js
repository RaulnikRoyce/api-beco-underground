const db = require('../database/db');

exports.salvar = async (eventoId, bandaId, horario, cacheNegociado) => {
    const [result] = await db.promise().query(
        `INSERT INTO lineup (evento_id, banda_id, horario, cache_negociado)
         VALUES (?, ?, ?, ?)`,
        [eventoId, bandaId, horario, cacheNegociado ?? null]
    );

    return {
        id: result.insertId,
        evento_id: eventoId,
        banda_id: bandaId,
        horario,
        cache_negociado: cacheNegociado ?? null
    };
};

exports.buscarPorEvento = async (eventoId) => {
    const [resultados] = await db.promise().query(
        `SELECT
            l.id,
            l.id AS lineup_id,
            b.nome,
            b.nome AS banda,
            TIME_FORMAT(l.horario, '%H:%i') AS horario,
            COALESCE(l.cache_negociado, b.cache_base) AS cache
         FROM lineup l
         JOIN bandas b ON l.banda_id = b.id
         WHERE l.evento_id = ?
         ORDER BY l.horario ASC`,
        [eventoId]
    );

    return resultados;
};

exports.remover = async (id) => {
    const [result] = await db.promise().query('DELETE FROM lineup WHERE id = ?', [id]);
    return result.affectedRows > 0;
};
