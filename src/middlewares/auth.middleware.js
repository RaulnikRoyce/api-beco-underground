// src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');

exports.verificarToken = (req, res, next) => {
    const tokenHeader = req.headers['authorization'];
    
    if (!tokenHeader) {
        return res.status(403).json({ erro: 'Nenhum token fornecido. Acesso negado!' });
    }
    
    const token = tokenHeader.replace('Bearer ', '');

    jwt.verify(token, 'MINHA_CHAVE_SECRETA_MUITO_SEGURA', (err, decoded) => {
        if (err) {
            return res.status(401).json({ erro: 'Token inválido ou expirado!' });
        }
        
        req.usuarioId = decoded.id;
        next(); 
    });
};