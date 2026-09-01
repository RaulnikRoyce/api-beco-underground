const db = require('../database/db');

exports.inscrever = (eventoId, email) => new Promise((resolve, reject) => {
    db.query(
        'INSERT INTO lista_espera (evento_id, email) VALUES (?, ?)',
        [eventoId, email.toLowerCase()],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return resolve({ duplicado: true });
                return reject(err);
            }
            resolve({ id: result.insertId, duplicado: false });
        }
    );
});

exports.listarPorEvento = (eventoId) => new Promise((resolve, reject) => {
    db.query(
        'SELECT id, email, avisado_em, criado_em FROM lista_espera WHERE evento_id = ? ORDER BY criado_em ASC',
        [eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        }
    );
});
