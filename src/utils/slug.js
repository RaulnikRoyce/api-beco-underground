const db = require('../database/db');

exports.gerarSlugBase = (nome) => {
    const base = String(nome || 'evento')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

    return base || 'evento';
};

exports.garantirSlugUnico = (base, eventoIdExcluir = null) => new Promise((resolve, reject) => {
    const tentar = (slug, sufixo) => {
        const candidato = sufixo ? `${slug}-${sufixo}`.slice(0, 120) : slug;
        const params = [candidato];
        let sql = 'SELECT id FROM eventos WHERE slug = ?';

        if (eventoIdExcluir != null) {
            sql += ' AND id != ?';
            params.push(eventoIdExcluir);
        }

        db.query(sql, params, (err, rows) => {
            if (err) return reject(err);
            if (!rows.length) return resolve(candidato);
            tentar(slug, (sufixo || 1) + 1);
        });
    };

    tentar(base, 0);
});
