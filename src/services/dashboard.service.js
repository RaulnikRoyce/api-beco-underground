const db = require('../database/db');

exports.obterResumo = (evento_id) => {
    return new Promise((resolve, reject) => {
        // Query para somar os custos e contar as bandas
        const sqlResumo = `
            SELECT 
                COUNT(l.id) AS total_bandas, 
                SUM(COALESCE(l.cache_negociado, b.cache_base)) AS custo_total_caches
            FROM lineup l
            JOIN bandas b ON l.banda_id = b.id
            WHERE l.evento_id = ?
        `;

        // Query para listar as atrações (exatamente como o frontend espera)
        const sqlAtracoes = `
            SELECT 
                l.horario, 
                b.nome AS banda, 
                COALESCE(l.cache_negociado, b.cache_base) AS custo_banda
            FROM lineup l
            JOIN bandas b ON l.banda_id = b.id
            WHERE l.evento_id = ?
            ORDER BY l.horario ASC
        `;

        db.query(sqlResumo, [evento_id], (err, resultResumo) => {
            if (err) return reject(err);

            db.query(sqlAtracoes, [evento_id], (err, resultAtracoes) => {
                if (err) return reject(err);

                // Monta o objeto exato que o seu index.html precisa
                resolve({
                    total_bandas: resultResumo[0].total_bandas || 0,
                    custo_total_caches: resultResumo[0].custo_total_caches || 0,
                    atracoes: resultAtracoes
                });
            });
        });
    });
};