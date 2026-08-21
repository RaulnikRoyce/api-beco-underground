const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
const { getJwtSecret } = require('../config/jwt');
const { asyncHandler, AppError } = require('../utils/erros');
const { criado } = require('../utils/resposta');

exports.login = asyncHandler(async (req, res) => {
    const { email, senha } = req.body;
    const usuario = await authService.autenticar(email, senha);

    if (!usuario) {
        throw new AppError(401, 'Credenciais inválidas');
    }

    const token = jwt.sign(
        { id: usuario.id, perfil: usuario.perfil },
        getJwtSecret(),
        { expiresIn: '8h' }
    );

    res.json({
        mensagem: 'Login realizado',
        token,
        perfil: usuario.perfil,
        email: usuario.email,
        id: usuario.id
    });
});

exports.registrar = asyncHandler(async (req, res) => {
    const { email, senha, perfil } = req.body;
    const perfilFinal = req.usuario?.perfil === 'admin' ? (perfil || 'produtor') : 'produtor';
    await authService.registrar(email, senha, perfilFinal);
    criado(res, 'Usuário cadastrado');
});
