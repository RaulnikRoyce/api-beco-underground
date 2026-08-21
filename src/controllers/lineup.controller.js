const lineupService = require('../services/lineup.service');
const { asyncHandler } = require('../utils/erros');
const { ok, criado } = require('../utils/resposta');

exports.adicionarBanda = asyncHandler(async (req, res) => {
    const { evento_id, banda_id, horario, cache_negociado } = req.body;
    const lineup = await lineupService.adicionarNaLineup(evento_id, banda_id, horario, cache_negociado);
    criado(res, 'Artista escalado', { lineup });
});

exports.listarLineup = asyncHandler(async (req, res) => {
    ok(res, await lineupService.listarLineupDoEvento(req.params.evento_id));
});
