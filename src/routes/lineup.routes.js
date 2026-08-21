const express = require('express');
const router = express.Router();
const lineupController = require('../controllers/lineup.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarSchema, validarId } = require('../middlewares/validador');
const { lineupSchema, lineupPatchSchema } = require('../schemas/lineup.schema');

router.get('/:evento_id', verificarToken, validarId('evento_id'), lineupController.listarLineup);
router.post('/', verificarToken, verificarPerfil(['admin']), validarSchema(lineupSchema), lineupController.adicionarBanda);
router.patch('/:id', verificarToken, verificarPerfil(['admin']), validarId('id'), validarSchema(lineupPatchSchema), lineupController.atualizarSlot);
router.delete('/:id', verificarToken, verificarPerfil(['admin']), validarId('id'), lineupController.removerSlot);

module.exports = router;
