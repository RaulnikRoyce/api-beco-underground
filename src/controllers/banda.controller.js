const bandaService = require('../services/banda.service');
const { asyncHandler, AppError } = require('../utils/erros');
const { ok, criado, mensagem } = require('../utils/resposta');

exports.listarBandas = asyncHandler(async (req, res) => {
    ok(res, await bandaService.listarBandas(req.usuario));
});

exports.obterBandaPorId = asyncHandler(async (req, res) => {
    const banda = await bandaService.obterBandaPorId(req.params.id, req.usuario);
    if (!banda) throw new AppError(404, 'Banda não encontrada');
    ok(res, banda);
});

exports.adicionarBanda = asyncHandler(async (req, res) => {
    const banda = await bandaService.adicionarBanda(req.body);
    criado(res, 'Banda cadastrada', { banda });
});

exports.atualizarBanda = asyncHandler(async (req, res) => {
    ok(res, await bandaService.atualizarBanda(req.params.id, req.body));
});

exports.excluirBanda = asyncHandler(async (req, res) => {
    await bandaService.excluirBanda(req.params.id);
    mensagem(res, 'Banda excluída');
});
