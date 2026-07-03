// src/routes/evento.routes.js
const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/evento.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

// Listar todos os eventos
router.get('/', verificarToken, eventoController.listarEventos);

// Buscar um evento específico pelo ID
router.get('/:id', verificarToken, eventoController.obterEventoPorId);

module.exports = router;