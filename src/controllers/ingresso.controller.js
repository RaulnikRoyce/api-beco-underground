const ingressoService = require('../services/ingresso.service');
const { asyncHandler } = require('../utils/erros');
const { ok, criado, mensagem } = require('../utils/resposta');

exports.listarCustos = asyncHandler(async (req, res) => {
    ok(res, await ingressoService.listarCustos(req.params.evento_id, req.usuario));
});

exports.criarCusto = asyncHandler(async (req, res) => {
    const custo = await ingressoService.criarCusto(req.params.evento_id, req.body, req.usuario);
    criado(res, 'Custo adicionado', { custo });
});

exports.atualizarCusto = asyncHandler(async (req, res) => {
    ok(res, await ingressoService.atualizarCusto(
        req.params.evento_id,
        req.params.custo_id,
        req.body,
        req.usuario
    ));
});

exports.excluirCusto = asyncHandler(async (req, res) => {
    await ingressoService.excluirCusto(req.params.evento_id, req.params.custo_id, req.usuario);
    mensagem(res, 'Custo removido');
});

exports.listarLotes = asyncHandler(async (req, res) => {
    ok(res, await ingressoService.listarLotes(req.params.evento_id, req.usuario));
});

exports.criarLote = asyncHandler(async (req, res) => {
    const lote = await ingressoService.criarLote(req.params.evento_id, req.body, req.usuario);
    criado(res, 'Lote criado', { lote });
});

exports.criarLotesSugeridos = asyncHandler(async (req, res) => {
    const lotes = await ingressoService.criarLotesSugeridos(req.params.evento_id, req.usuario);
    criado(res, 'Lotes sugeridos criados', { lotes });
});

exports.atualizarLote = asyncHandler(async (req, res) => {
    ok(res, await ingressoService.atualizarLote(
        req.params.evento_id,
        req.params.lote_id,
        req.body,
        req.usuario
    ));
});

exports.excluirLote = asyncHandler(async (req, res) => {
    await ingressoService.excluirLote(req.params.evento_id, req.params.lote_id, req.usuario);
    mensagem(res, 'Lote removido');
});

exports.obterResumo = asyncHandler(async (req, res) => {
    ok(res, await ingressoService.obterResumo(req.params.evento_id, req.usuario));
});

exports.obterPrecificacao = asyncHandler(async (req, res) => {
    ok(res, await ingressoService.obterPrecificacao(req.params.evento_id, req.usuario, req.query));
});

exports.atualizarConfig = asyncHandler(async (req, res) => {
    ok(res, await ingressoService.atualizarConfig(req.params.evento_id, req.body, req.usuario));
});

exports.publicarVenda = asyncHandler(async (req, res) => {
    const config = await ingressoService.publicarVenda(
        req.params.evento_id,
        req.usuario,
        req.body.publicado !== false
    );
    ok(res, config);
});

exports.emitirCortesia = asyncHandler(async (req, res) => {
    const resultado = await ingressoService.emitirCortesia(req.params.evento_id, req.body, req.usuario);
    criado(res, 'Cortesia emitida', resultado);
});

exports.emitirVendaPorta = asyncHandler(async (req, res) => {
    const resultado = await ingressoService.emitirVendaPorta(req.params.evento_id, req.body, req.usuario);
    criado(res, 'Venda na porta registrada', resultado);
});

exports.listarEventosPublicos = asyncHandler(async (req, res) => {
    ok(res, await ingressoService.listarEventosPublicos());
});

exports.obterEventoPublico = asyncHandler(async (req, res) => {
    ok(res, await ingressoService.obterEventoPublico(req.params.slugOuId, req.query.preview_token));
});

exports.criarTokenPreview = asyncHandler(async (req, res) => {
    ok(res, await ingressoService.criarTokenPreview(req.params.evento_id, req.usuario));
});
