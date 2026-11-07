const pedidoService = require('../services/pedido.service');
const mercadopagoService = require('../services/mercadopago.service');
const { asyncHandler, AppError } = require('../utils/erros');
const { ok, criado } = require('../utils/resposta');
const logger = require('../utils/logger');

exports.criarPedido = asyncHandler(async (req, res) => {
    criado(res, 'Pedido criado', await pedidoService.criarPedido(req.body));
});

exports.previsualizarPedido = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.previsualizarPedido(req.body));
});

exports.obterPedido = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.obterPedidoPublico(req.params.codigo));
});

exports.obterIngresso = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.obterIngressoPublico(req.params.codigo));
});

exports.webhook = asyncHandler(async (req, res) => {
    const candidatos = [req.query['data.id'], req.query.id, req.body?.data?.id ?? req.body?.id]
        .filter((id) => id !== undefined && id !== null && id !== '')
        .map((id) => String(id).trim());
    if (candidatos.some((id) => !/^\d{1,32}$/.test(id)) || new Set(candidatos).size > 1) {
        throw new AppError(400, 'Identificador de pagamento inválido ou divergente.');
    }
    const dataId = candidatos[0] || null;
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (secret) {
        const valido = mercadopagoService.validarAssinaturaWebhook({
            xSignature: req.get('x-signature'),
            xRequestId: req.get('x-request-id'),
            dataId,
            secret
        });
        if (!valido) {
            logger.warn('Webhook do Mercado Pago recusado por assinatura inválida', { ip: req.ip });
            return res.status(401).json({ erro: 'Assinatura inválida' });
        }
    }

    const resultado = await pedidoService.processarWebhook(req.body, dataId);
    ok(res, resultado);
});

exports.checkin = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.checkin(req.params.codigo, req.usuario));
});

exports.listarCompradores = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.listarCompradores(req.params.evento_id, req.usuario, req.query));
});

exports.compradoresCsv = asyncHandler(async (req, res) => {
    const csv = await pedidoService.compradoresCsv(req.params.evento_id, req.usuario, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="compradores-${req.params.evento_id}.csv"`);
    res.send(csv);
});

exports.listaPorta = asyncHandler(async (req, res) => {
    const html = await pedidoService.listaPortaHtml(req.params.evento_id, req.usuario);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});

exports.inscreverListaEspera = asyncHandler(async (req, res) => {
    criado(res, 'Inscrito na lista de espera', await pedidoService.inscreverListaEspera(req.body.evento_id, req.body.email));
});

exports.recuperarIngresso = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.recuperarIngresso(req.body));
});

exports.financeiroDashboard = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.obterFinanceiroDashboard(req.usuario));
});

exports.criarCupom = asyncHandler(async (req, res) => {
    const cupom = await pedidoService.criarCupom(req.params.evento_id, req.usuario, req.body);
    criado(res, 'Cupom criado', { cupom });
});

exports.listarCupons = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.listarCupons(req.params.evento_id, req.usuario));
});

exports.cancelarPedido = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.cancelarPedido(
        req.params.evento_id,
        req.params.codigo,
        req.usuario
    ));
});
