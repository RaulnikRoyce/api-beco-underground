const pedidoService = require('../services/pedido.service');
const cupomRepository = require('../repositories/cupom.repository');
const { asyncHandler } = require('../utils/erros');
const { ok, criado } = require('../utils/resposta');

exports.criarPedido = asyncHandler(async (req, res) => {
    criado(res, 'Pedido criado', await pedidoService.criarPedido(req.body));
});

exports.obterPedido = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.obterPedidoPublico(req.params.codigo));
});

exports.obterIngresso = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.obterIngressoPublico(req.params.codigo));
});

exports.webhook = asyncHandler(async (req, res) => {
    const resultado = await pedidoService.processarWebhook(req.body);
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
    const cupom = await cupomRepository.criar({ ...req.body, evento_id: req.params.evento_id });
    criado(res, 'Cupom criado', { cupom });
});

exports.listarCupons = asyncHandler(async (req, res) => {
    ok(res, await cupomRepository.listarPorEvento(req.params.evento_id));
});

exports.cancelarPedido = asyncHandler(async (req, res) => {
    ok(res, await pedidoService.cancelarPedido(
        req.params.evento_id,
        req.params.codigo,
        req.usuario
    ));
});
