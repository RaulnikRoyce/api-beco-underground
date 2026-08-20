const bandaRepository = require('../repositories/banda.repository');

exports.listarBandas = () => bandaRepository.buscarTodas();

exports.obterBandaPorId = (id) => bandaRepository.buscarPorId(id);

exports.adicionarBanda = (dadosBanda) => bandaRepository.salvar(dadosBanda);

exports.removerBanda = (id) => bandaRepository.remover(id);
