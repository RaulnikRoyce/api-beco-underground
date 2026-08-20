const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validarSchema } = require('../middlewares/validador');
const { loginSchema, registroSchema } = require('../schemas/auth.schema');

router.post('/login', validarSchema(loginSchema), authController.login);
router.post('/registrar', validarSchema(registroSchema), authController.registrar);

module.exports = router;