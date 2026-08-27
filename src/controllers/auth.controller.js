const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
const { getJwtSecret } = require('../config/jwt');
const { asyncHandler, AppError } = require('../utils/erros');
const { ok, criado, mensagem } = require('../utils/resposta');

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
    const { email, senha } = req.body;
    await authService.registrar(email, senha);
    criado(res, 'Conta de produtor criada');
});

exports.listarUsuarios = asyncHandler(async (_req, res) => {
    ok(res, await authService.listarUsuarios());
});

exports.definirAtivo = asyncHandler(async (req, res) => {
    const usuario = await authService.definirAtivo(req.params.id, req.body.ativo, req.usuario);
    res.json({ mensagem: usuario.ativo ? 'Conta ativada' : 'Conta desativada', usuario });
});

exports.excluirUsuario = asyncHandler(async (req, res) => {
    await authService.excluirUsuario(req.params.id, req.usuario);
    mensagem(res, 'Usuário excluído');
});

exports.redefinirSenha = asyncHandler(async (req, res) => {
    await authService.redefinirSenha(req.params.id, req.body.senha, req.usuario);
    mensagem(res, 'Senha redefinida');
});

exports.trocarPropriaSenha = asyncHandler(async (req, res) => {
    await authService.trocarPropriaSenha(req.usuario, req.body.senha_atual, req.body.senha);
    mensagem(res, 'Senha atualizada');
});
