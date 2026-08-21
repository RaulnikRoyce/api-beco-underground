const db = require('../database/db');

exports.buscarPorEmail = (email) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM usuarios WHERE email = ?', [email], (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados[0] || null);
    });
});

exports.salvar = (email, senhaCriptografada, perfil) => new Promise((resolve, reject) => {
    db.query(
        'INSERT INTO usuarios (email, senha, perfil) VALUES (?, ?, ?)',
        [email, senhaCriptografada, perfil],
        (err, result) => {
            if (err) return reject(err);
            resolve({ id: result.insertId, email, perfil });
        }
    );
});
