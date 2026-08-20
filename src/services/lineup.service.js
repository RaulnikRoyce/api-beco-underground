const lineupRepository = require('../repositories/lineup.repository');

exports.adicionarNaLineup = (eventoId, bandaId, horario, cacheNegociado) =>
    lineupRepository.salvar(eventoId, bandaId, horario, cacheNegociado);

exports.listarLineupDoEvento = (eventoId) => lineupRepository.buscarPorEvento(eventoId);
