// src/routes/dashboard.routes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');

// Agora exige token E exige perfil 'admin'
router.get(
    '/:evento_id', 
    verificarToken, 
    verificarPerfil(['admin']), 
    dashboardController.carregarDashboard
);

module.exports = router;