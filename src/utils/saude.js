const checarBanco = (db) => new Promise((resolve, reject) => {
    db.query('SELECT 1', (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados);
    });
});

const responderHealth = (db, { pularBanco = process.env.NODE_ENV === 'test' } = {}) =>
    async (_req, res) => {
        if (pularBanco) {
            return res.json({ status: 'ok' });
        }

        try {
            await checarBanco(db);
            return res.json({ status: 'ok' });
        } catch {
            return res.status(503).json({ status: 'erro' });
        }
    };

module.exports = { checarBanco, responderHealth };
