const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarId } = require('../middlewares/validador');

router.get(
    '/:evento_id',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    dashboardController.carregarDashboard
);

module.exports = router;
