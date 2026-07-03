// src/routes/lineup.routes.js
const express = require('express');
const router = express.Router();
const lineupController = require('../controllers/lineup.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { validarSchema } = require('../middlewares/validador');
const { lineupSchema } = require('../schemas/lineup.schema');

// Listar o line-up (apenas leitura)
router.get('/:evento_id', verificarToken, lineupController.listarLineup);

// Adicionar banda ao line-up (Passa pelo Token e pelo Zod)
router.post('/', verificarToken, validarSchema(lineupSchema), lineupController.adicionarBanda);

module.exports = router;