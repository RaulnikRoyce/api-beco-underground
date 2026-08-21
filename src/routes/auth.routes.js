const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarSchema } = require('../middlewares/validador');
const { loginSchema, registrarSchema } = require('../schemas/auth.schema');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' }
});

router.post('/login', authLimiter, validarSchema(loginSchema), authController.login);
router.post(
    '/registrar',
    verificarToken,
    verificarPerfil(['admin']),
    validarSchema(registrarSchema),
    authController.registrar
);

module.exports = router;
