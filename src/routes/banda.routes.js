const express = require('express');
const router = express.Router();
const bandaController = require('../controllers/banda.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarSchema } = require('../middlewares/validador');
const { bandaSchema } = require('../schemas/banda.schema');

router.get('/', verificarToken, bandaController.listarBandas);
router.get('/:id', verificarToken, bandaController.obterBandaPorId);
router.post(
    '/',
    verificarToken,
    verificarPerfil(['admin']),
    validarSchema(bandaSchema),
    bandaController.adicionarBanda
);
router.delete(
    '/:id',
    verificarToken,
    verificarPerfil(['admin']),
    bandaController.removerBanda
);

module.exports = router;
