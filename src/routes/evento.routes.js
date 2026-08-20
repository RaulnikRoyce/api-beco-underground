const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/evento.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarSchema } = require('../middlewares/validador');
const { eventoSchema } = require('../schemas/evento.schema');

router.get('/', verificarToken, eventoController.listarEventos);
router.get('/:id', verificarToken, eventoController.obterEventoPorId);
router.post(
    '/',
    verificarToken,
    verificarPerfil(['admin']),
    validarSchema(eventoSchema),
    eventoController.criarEvento
);
router.put(
    '/:id',
    verificarToken,
    verificarPerfil(['admin']),
    validarSchema(eventoSchema),
    eventoController.atualizarEvento
);
router.delete(
    '/:id',
    verificarToken,
    verificarPerfil(['admin']),
    eventoController.removerEvento
);

module.exports = router;
