const eventoRepository = require('../repositories/evento.repository');

exports.listarEventos = () => eventoRepository.buscarTodos();

exports.obterEventoPorId = (id) => eventoRepository.buscarPorId(id);

exports.criarEvento = (dados) => eventoRepository.salvar(dados);

exports.atualizarEvento = (id, dados) => eventoRepository.atualizar(id, dados);

exports.removerEvento = (id) => eventoRepository.remover(id);
