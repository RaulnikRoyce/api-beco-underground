const eventoRepository = require('../repositories/evento.repository');

exports.listarEventos = () => eventoRepository.buscarTodos();

exports.obterEventoPorId = (id) => eventoRepository.buscarPorId(id);
