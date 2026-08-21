const eventoService = require('../services/evento.service');
const { asyncHandler, AppError } = require('../utils/erros');
const { ok, criado, mensagem } = require('../utils/resposta');

exports.listarEventos = asyncHandler(async (req, res) => {
    const eventos = await eventoService.listarEventos(req.query);
    ok(res, eventos);
});

exports.obterEventoPorId = asyncHandler(async (req, res) => {
    const evento = await eventoService.obterEventoPorId(req.params.id);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    ok(res, evento);
});

exports.adicionarEvento = asyncHandler(async (req, res) => {
    const evento = await eventoService.adicionarEvento(req.body, req.usuario);
    criado(res, 'Evento criado', { evento });
});

exports.excluirEvento = asyncHandler(async (req, res) => {
    await eventoService.excluirEvento(req.params.id, req.usuario);
    mensagem(res, 'Evento excluído');
});

exports.atualizarEvento = asyncHandler(async (req, res) => {
    const evento = await eventoService.atualizarEvento(req.params.id, req.body, req.usuario);
    ok(res, evento);
});
