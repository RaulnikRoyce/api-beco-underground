const db = require('../database/db');

exports.obterResumoDoEvento = async (eventoId) => {
    const [[resumo]] = await db.promise().query(
        `SELECT
            COUNT(l.id) AS total_bandas,
            COALESCE(SUM(COALESCE(l.cache_negociado, b.cache_base)), 0) AS custo_total_caches
         FROM lineup l
         JOIN bandas b ON l.banda_id = b.id
         WHERE l.evento_id = ?`,
        [eventoId]
    );

    const [atracoes] = await db.promise().query(
        `SELECT
            TIME_FORMAT(l.horario, '%H:%i') AS horario,
            b.nome AS banda,
            COALESCE(l.cache_negociado, b.cache_base) AS custo_banda
         FROM lineup l
         JOIN bandas b ON l.banda_id = b.id
         WHERE l.evento_id = ?
         ORDER BY l.horario ASC`,
        [eventoId]
    );

    return {
        total_bandas: Number(resumo.total_bandas) || 0,
        custo_total_caches: Number(resumo.custo_total_caches) || 0,
        atracoes
    };
};
