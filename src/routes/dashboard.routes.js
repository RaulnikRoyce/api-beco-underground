// src/routes/dashboard.routes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

// Agora exige o token para exibir os cachês
router.get('/:evento_id', verificarToken, dashboardController.carregarDashboard);

module.exports = router;