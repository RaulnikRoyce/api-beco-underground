// src/services/lineup.service.js
const lineupRepository = require('../repositories/lineup.repository');

exports.adicionarNaLineup = async (evento_id, banda_id, horario, cache_negociado) => {
    // Aqui no futuro podemos validar se o horário já está ocupado por outra banda
    return await lineupRepository.salvar(evento_id, banda_id, horario, cache_negociado);
};

exports.listarLineupDoEvento = async (evento_id) => {
    return await lineupRepository.buscarPorEvento(evento_id);
};