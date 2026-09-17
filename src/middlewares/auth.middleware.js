const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');
const authRepository = require('../repositories/auth.repository');
const { contaAtiva } = require('../utils/usuario.regras');

exports.verificarToken = async (req, res, next) => {
    const authorization = req.get('authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Token não fornecido.' });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
        return res.status(401).json({ erro: 'Token não fornecido.' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    } catch {
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }

    let usuario;
    try {
        usuario = await authRepository.buscarPorId(decoded.id);
    } catch {
        return res.status(503).json({ erro: 'Não foi possível validar a sessão. Tente de novo.' });
    }

    if (!usuario || !contaAtiva(usuario)) {
        return res.status(401).json({ erro: 'Sessão inválida. Faça login novamente.' });
    }

    req.usuario = { id: usuario.id, perfil: usuario.perfil };
    req.usuarioId = usuario.id;
    return next();
};

exports.verificarPerfil = (perfisPermitidos) => (req, res, next) => {
    const perfil = req.usuario?.perfil;

    if (!perfil || !perfisPermitidos.includes(perfil)) {
        return res.status(403).json({ erro: 'Acesso negado.' });
    }

    return next();
};
