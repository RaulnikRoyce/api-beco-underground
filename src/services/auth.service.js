const bcrypt = require('bcryptjs');
const authRepository = require('../repositories/auth.repository');

exports.autenticar = async (email, senha) => {
    const usuario = await authRepository.buscarPorEmail(email);
    if (!usuario) return null;

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return null;

    return usuario;
};

exports.registrar = async (email, senha, perfil = 'produtor') => {
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    return authRepository.salvar(email, senhaCriptografada, perfil);
};
