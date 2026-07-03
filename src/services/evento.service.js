// src/services/evento.service.js
const eventoRepository = require('../repositories/evento.repository');

exports.listarEventos = async () => {
    return await eventoRepository.buscarTodos();
};

exports.obterEventoPorId = async (id) => {
    return await eventoRepository.buscarPorId(id);
};