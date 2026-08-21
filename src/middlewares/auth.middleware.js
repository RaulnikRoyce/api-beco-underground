const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');

exports.verificarToken = (req, res, next) => {
    const authorization = req.get('authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Token não fornecido.' });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
        return res.status(401).json({ erro: 'Token não fornecido.' });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        req.usuario = decoded;
        req.usuarioId = decoded.id;
        return next();
    } catch {
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
};

exports.verificarPerfil = (perfisPermitidos) => (req, res, next) => {
    const perfil = req.usuario?.perfil;

    if (!perfil || !perfisPermitidos.includes(perfil)) {
        return res.status(403).json({ erro: 'Acesso negado.' });
    }

    return next();
};
