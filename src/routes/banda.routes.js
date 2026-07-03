// src/routes/banda.routes.js
const express = require('express');
const router = express.Router();
const bandaController = require('../controllers/banda.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarSchema } = require('../middlewares/validador');

// Importação do schema do Zod (garanta que o nome do arquivo bate com o que você criou)
const { bandaSchema } = require('../schemas/banda.schema'); 

// Leitura: Qualquer um com token logado pode ver as bandas
router.get('/', verificarToken, bandaController.listarBandas);
router.get('/:id', verificarToken, bandaController.obterBandaPorId);

// Criação: Exige Token, exige validação do Zod, E exige ser 'admin'
router.post('/', verificarToken, verificarPerfil(['admin']), validarSchema(bandaSchema), bandaController.adicionarBanda);

// A FALTA DESTA LINHA ABAIXO É O QUE CAUSA O ERRO NO APP.JS:
module.exports = router;