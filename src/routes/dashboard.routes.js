const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

router.get('/:evento_id', dashboardController.carregarDashboard);

module.exports = router;
