// src/services/banda.service.js
const bandaRepository = require('../repositories/banda.repository');

exports.listarBandas = async () => {
    return await bandaRepository.buscarTodas();
};

// Aqui está a peça que faltava!
exports.obterBandaPorId = async (id) => {
    return await bandaRepository.buscarPorId(id);
};

exports.adicionarBanda = async (dadosBanda) => {
    // A validação do Zod já aconteceu lá na rota, então os dados aqui já estão limpos e seguros
    return await bandaRepository.salvar(dadosBanda);
};