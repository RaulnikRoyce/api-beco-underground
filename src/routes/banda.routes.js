const express = require('express');
const router = express.Router();
const bandaController = require('../controllers/banda.controller');
// Aqui você importaria o middleware de autenticação (deixaremos para o próximo passo)

router.get('/', bandaController.listarBandas);
router.post('/', bandaController.cadastrarBanda);

module.exports = router;