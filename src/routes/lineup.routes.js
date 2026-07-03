// src/routes/lineup.routes.js
const express = require('express');
const router = express.Router();
const lineupController = require('../controllers/lineup.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

// Listar o line-up de um evento específico
router.get('/:evento_id', verificarToken, lineupController.listarLineup);

// Adicionar uma banda ao line-up de um evento
router.post('/', verificarToken, lineupController.adicionarBanda);

module.exports = router;