const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarSchema, validarId } = require('../middlewares/validador');
const { loginSchema, registrarSchema, alterarUsuarioSchema, redefinirSenhaSchema, trocarPropriaSenhaSchema } = require('../schemas/auth.schema');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Aguarde 15 minutos.' }
});

router.post('/login', authLimiter, validarSchema(loginSchema), authController.login);
router.post('/registrar', authLimiter, validarSchema(registrarSchema), authController.registrar);

router.patch(
    '/senha',
    authLimiter,
    verificarToken,
    validarSchema(trocarPropriaSenhaSchema),
    authController.trocarPropriaSenha
);

router.get('/usuarios', verificarToken, verificarPerfil(['admin']), authController.listarUsuarios);
router.patch(
    '/usuarios/:id',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('id'),
    validarSchema(alterarUsuarioSchema),
    authController.definirAtivo
);
router.patch(
    '/usuarios/:id/senha',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('id'),
    validarSchema(redefinirSenhaSchema),
    authController.redefinirSenha
);
router.delete(
    '/usuarios/:id',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('id'),
    authController.excluirUsuario
);

module.exports = router;
