// src/routes/banda.routes.js
const express = require('express');
const router = express.Router();
const bandaController = require('../controllers/banda.controller');
const { verificarToken } = require('../middlewares/auth.middleware'); // Correção aqui!
const { validarSchema } = require('../middlewares/validador'); 
const { bandaSchema } = require('../schemas/banda.schema');

// Rota de listagem não precisa de validação de corpo, só do crachá
router.get('/', verificarToken, bandaController.listarBandas); // Correção aqui!

// Rota de criação agora passa pelo validador antes de chegar no controller!
router.post('/', verificarToken, validarSchema(bandaSchema), bandaController.adicionarBanda); // Correção aqui!

module.exports = router;