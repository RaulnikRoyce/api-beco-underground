const express = require('express');
const router = express.Router({ mergeParams: true });
const ingressoController = require('../controllers/ingresso.controller');
const { verificarToken, verificarPerfil } = require('../middlewares/auth.middleware');
const { validarSchema, validarQuery, validarId } = require('../middlewares/validador');
const pedidoController = require('../controllers/pedido.controller');
const { compradoresQuery, cupomSchema } = require('../schemas/pedido.schema');
const {
    custoSchema,
    custoPatchSchema,
    loteSchema,
    lotePatchSchema,
    configIngressoSchema,
    publicarSchema,
    cortesiaSchema,
    portaSchema,
    precificacaoQuery
} = require('../schemas/ingresso.schema');

router.get('/custos', verificarToken, validarId('evento_id'), ingressoController.listarCustos);
router.post(
    '/custos',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    validarSchema(custoSchema),
    ingressoController.criarCusto
);
router.patch(
    '/custos/:custo_id',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    validarId('custo_id'),
    validarSchema(custoPatchSchema),
    ingressoController.atualizarCusto
);
router.delete(
    '/custos/:custo_id',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    validarId('custo_id'),
    ingressoController.excluirCusto
);

router.get('/lotes', verificarToken, validarId('evento_id'), ingressoController.listarLotes);
router.post(
    '/lotes',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    validarSchema(loteSchema),
    ingressoController.criarLote
);
router.post(
    '/lotes/gerar-sugeridos',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    ingressoController.criarLotesSugeridos
);
router.patch(
    '/lotes/:lote_id',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    validarId('lote_id'),
    validarSchema(lotePatchSchema),
    ingressoController.atualizarLote
);
router.delete(
    '/lotes/:lote_id',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    validarId('lote_id'),
    ingressoController.excluirLote
);

router.get(
    '/ingressos/resumo',
    verificarToken,
    validarId('evento_id'),
    ingressoController.obterResumo
);
router.get(
    '/ingressos/precificacao',
    verificarToken,
    validarId('evento_id'),
    validarQuery(precificacaoQuery),
    ingressoController.obterPrecificacao
);
router.patch(
    '/ingressos/config',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    validarSchema(configIngressoSchema),
    ingressoController.atualizarConfig
);
router.patch(
    '/ingressos/publicar',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    validarSchema(publicarSchema),
    ingressoController.publicarVenda
);
router.post(
    '/ingressos/cortesia',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    validarSchema(cortesiaSchema),
    ingressoController.emitirCortesia
);
router.post(
    '/ingressos/porta',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    validarSchema(portaSchema),
    ingressoController.emitirVendaPorta
);

router.get(
    '/ingressos/compradores',
    verificarToken,
    validarId('evento_id'),
    validarQuery(compradoresQuery),
    pedidoController.listarCompradores
);
router.get(
    '/ingressos/compradores.csv',
    verificarToken,
    validarId('evento_id'),
    validarQuery(compradoresQuery),
    pedidoController.compradoresCsv
);
router.get(
    '/ingressos/lista-porta.pdf',
    verificarToken,
    validarId('evento_id'),
    pedidoController.listaPorta
);
router.get(
    '/ingressos/cupons',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    pedidoController.listarCupons
);
router.post(
    '/ingressos/cupons',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    validarSchema(cupomSchema),
    pedidoController.criarCupom
);
router.post(
    '/ingressos/pedidos/:codigo/cancelar',
    verificarToken,
    verificarPerfil(['admin']),
    validarId('evento_id'),
    pedidoController.cancelarPedido
);

module.exports = router;
