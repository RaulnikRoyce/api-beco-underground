const db = require('../database/db');
const bcrypt = require('bcryptjs');

exports.autenticar = async (email, senha) => {
    const [resultados] = await db.promise().query(
        'SELECT id, email, senha, perfil FROM usuarios WHERE email = ?',
        [email]
    );

    if (resultados.length === 0) {
        return null;
    }

    const usuario = resultados[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
        return null;
    }

    return {
        id: usuario.id,
        email: usuario.email,
        perfil: usuario.perfil
    };
};

exports.registrar = async (email, senha) => {
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const [result] = await db.promise().query(
        'INSERT INTO usuarios (email, senha) VALUES (?, ?)',
        [email, senhaCriptografada]
    );

    return {
        id: result.insertId,
        email
    };
};
