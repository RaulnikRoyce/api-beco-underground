const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/evento.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.get('/', verificarToken, eventoController.listarEventos);
router.get('/:id', verificarToken, eventoController.obterEventoPorId);

module.exports = router;
