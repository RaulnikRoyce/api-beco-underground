const db = require('../database/db');
const bcrypt = require('bcryptjs');

exports.autenticar = async (email, senha) => {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM usuarios WHERE email = ?', [email], async (err, resultados) => {
            if (err) return reject(err);
            if (resultados.length === 0) return resolve(null);

            const usuario = resultados[0];
            const senhaValida = await bcrypt.compare(senha, usuario.senha);
            
            if (!senhaValida) return resolve(null);
            resolve(usuario);
        });
    });
};

exports.registrar = async (email, senha) => {
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    return new Promise((resolve, reject) => {
        db.query('INSERT INTO usuarios (email, senha) VALUES (?, ?)', [email, senhaCriptografada], (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
};