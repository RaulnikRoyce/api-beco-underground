// src/routes/lineup.routes.js
const express = require('express');
const router = express.Router();
const lineupController = require('../controllers/lineup.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarSchema } = require('../middlewares/validador');
const { lineupSchema } = require('../schemas/lineup.schema');

// Qualquer um logado pode ver a escalação
router.get('/:evento_id', verificarToken, lineupController.listarLineup);

// Somente admin pode escalar uma banda e definir o valor do cachê
router.post('/', verificarToken, verificarPerfil(['admin']), validarSchema(lineupSchema), lineupController.adicionarBanda);

module.exports = router;