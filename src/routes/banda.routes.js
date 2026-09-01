const express = require('express');
const router = express.Router();
const bandaController = require('../controllers/banda.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarSchema, validarId } = require('../middlewares/validador');
const { bandaSchema, bandaPatchSchema } = require('../schemas/banda.schema');

router.get('/', verificarToken, bandaController.listarBandas);
router.get('/:id', verificarToken, validarId('id'), bandaController.obterBandaPorId);
router.post('/', verificarToken, verificarPerfil(['admin']), validarSchema(bandaSchema), bandaController.adicionarBanda);
router.patch('/:id', verificarToken, verificarPerfil(['admin']), validarId('id'), validarSchema(bandaPatchSchema), bandaController.atualizarBanda);
router.delete('/:id', verificarToken, verificarPerfil(['admin']), validarId('id'), bandaController.excluirBanda);

module.exports = router;
