const express = require('express');
const router = express.Router();
const publicoController = require('../controllers/publico.controller');

router.get('/:token', publicoController.paginaBanda);

module.exports = router;
