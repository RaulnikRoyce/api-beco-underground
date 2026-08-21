const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/evento.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { validarSchema, validarQuery, validarId } = require('../middlewares/validador');
const { eventoSchema, listarEventosQuery } = require('../schemas/evento.schema');

router.get('/', verificarToken, validarQuery(listarEventosQuery), eventoController.listarEventos);
router.get('/:id', verificarToken, validarId('id'), eventoController.obterEventoPorId);
router.post('/', verificarToken, validarSchema(eventoSchema), eventoController.adicionarEvento);
router.delete('/:id', verificarToken, validarId('id'), eventoController.excluirEvento);

module.exports = router;
