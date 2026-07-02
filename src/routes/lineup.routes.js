const express = require('express');
const router = express.Router();
const lineupController = require('../controllers/lineup.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.get('/:evento_id', lineupController.listarLineup);
router.post('/', verificarToken, lineupController.adicionarAtraçao);

module.exports = router;