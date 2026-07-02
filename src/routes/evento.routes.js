const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/evento.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.get('/', eventoController.listarEventos);
router.get('/:id', eventoController.detalhesEvento);
router.post('/', verificarToken, eventoController.cadastrarEvento);

module.exports = router;