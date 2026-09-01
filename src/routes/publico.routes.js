const express = require('express');
const router = express.Router();
const publicoController = require('../controllers/publico.controller');
const ingressoController = require('../controllers/ingresso.controller');
const { validarQuery } = require('../middlewares/validador');
const { previewQuery } = require('../schemas/ingresso.schema');

router.get('/eventos', ingressoController.listarEventosPublicos);
router.get('/eventos/:slugOuId', validarQuery(previewQuery), ingressoController.obterEventoPublico);
router.get('/:token', publicoController.paginaBanda);

module.exports = router;
