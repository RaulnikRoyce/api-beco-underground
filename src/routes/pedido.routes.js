const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const pedidoController = require('../controllers/pedido.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarSchema } = require('../middlewares/validador');
const {
    pedidoSchema,
    previsualizarPedidoSchema,
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

const limitePreview = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Aguarde um instante.' }
});

const limiteWebhook = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas notificações.' }
});

const limiteConsultaPublica = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Aguarde alguns minutos.' }
});

router.post('/pedidos', limitePedidos, validarSchema(pedidoSchema), pedidoController.criarPedido);
router.post(
    '/pedidos/preview',
    limitePreview,
    validarSchema(previsualizarPedidoSchema),
    pedidoController.previsualizarPedido
);
router.get('/pedidos/:codigo', limiteConsultaPublica, pedidoController.obterPedido);
router.get('/emitidos/:codigo', limiteConsultaPublica, pedidoController.obterIngresso);
router.post('/webhook', limiteWebhook, pedidoController.webhook);
router.post('/recuperar', limiteConsultaPublica, validarSchema(recuperarSchema), pedidoController.recuperarIngresso);
router.post('/lista-espera', limiteConsultaPublica, validarSchema(listaEsperaSchema), pedidoController.inscreverListaEspera);

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
