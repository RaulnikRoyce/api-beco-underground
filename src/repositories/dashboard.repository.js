const db = require('../database/db');

exports.obterResumoDoEvento = (evento_id) => new Promise((resolve, reject) => {
    const sqlResumo = `
        SELECT
            COUNT(l.id) AS total_bandas,
            SUM(COALESCE(l.cache_negociado, b.cache_base)) AS custo_total_caches
        FROM lineup l
        JOIN bandas b ON l.banda_id = b.id
        WHERE l.evento_id = ?
    `;

    const sqlAtracoes = `
        SELECT
            TIME_FORMAT(l.horario, '%H:%i') AS horario,
            b.nome AS nome,
            COALESCE(l.cache_negociado, b.cache_base) AS cache
        FROM lineup l
        JOIN bandas b ON l.banda_id = b.id
        WHERE l.evento_id = ?
        ORDER BY
            CASE WHEN l.horario IS NULL THEN 1 ELSE 0 END,
            CASE WHEN HOUR(l.horario) < 12 THEN 1 ELSE 0 END,
            l.horario ASC,
            b.nome ASC
    `;

    db.query(sqlResumo, [evento_id], (err, resultResumo) => {
        if (err) return reject(err);

        db.query(sqlAtracoes, [evento_id], (errAtracoes, resultAtracoes) => {
            if (errAtracoes) return reject(errAtracoes);

            resolve({
                total_bandas: resultResumo[0].total_bandas || 0,
                custo_total_caches: resultResumo[0].custo_total_caches || 0,
                atracoes: resultAtracoes
            });
        });
    });
});
