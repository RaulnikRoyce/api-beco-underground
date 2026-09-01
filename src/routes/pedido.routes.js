const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const pedidoController = require('../controllers/pedido.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarSchema } = require('../middlewares/validador');
const {
    pedidoSchema,
    recuperarSchema,
    listaEsperaSchema
} = require('../schemas/pedido.schema');

const limitePedidos = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas de compra. Aguarde alguns minutos.' }
});

router.post('/pedidos', limitePedidos, validarSchema(pedidoSchema), pedidoController.criarPedido);
router.get('/pedidos/:codigo', pedidoController.obterPedido);
router.get('/emitidos/:codigo', pedidoController.obterIngresso);
router.post('/webhook', pedidoController.webhook);
router.post('/recuperar', validarSchema(recuperarSchema), pedidoController.recuperarIngresso);
router.post('/lista-espera', validarSchema(listaEsperaSchema), pedidoController.inscreverListaEspera);

router.post(
    '/checkin/:codigo',
    verificarToken,
    verificarPerfil(['admin']),
    pedidoController.checkin
);

router.get(
    '/dashboard/financeiro',
    verificarToken,
    verificarPerfil(['admin']),
    pedidoController.financeiroDashboard
);

module.exports = router;
