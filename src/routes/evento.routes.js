// src/routes/evento.routes.js
const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/evento.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { validarSchema } = require('../middlewares/validador');
const { eventoSchema } = require('../schemas/evento.schema');

// Rotas de leitura (não precisam de validação do Zod, apenas Token)
router.get('/', verificarToken, eventoController.listarEventos);
router.get('/:id', verificarToken, eventoController.obterEventoPorId);

// Se houver uma rota de criação de evento no futuro, ela ficaria assim:
// router.post('/', verificarToken, validarSchema(eventoSchema), eventoController.adicionarEvento);

module.exports = router;