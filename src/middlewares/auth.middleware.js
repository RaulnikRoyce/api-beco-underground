const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET não configurado. Defina a variável de ambiente antes de iniciar a API.');
    }

    return secret;
};

exports.verificarToken = (req, res, next) => {
    const authorization = req.get('authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Token de autenticação não fornecido.' });
    }

    const token = authorization.slice('Bearer '.length).trim();

    if (!token) {
        return res.status(401).json({ erro: 'Token de autenticação não fornecido.' });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());

        req.usuario = decoded;
        req.usuarioId = decoded.id;

        return next();
    } catch (error) {
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
};

exports.verificarPerfil = (perfisPermitidos) => {
    return (req, res, next) => {
        const perfilUsuario = req.usuario?.perfil;

        if (!perfilUsuario || !perfisPermitidos.includes(perfilUsuario)) {
            return res.status(403).json({ erro: 'Acesso negado.' });
        }

        return next();
    };
};
