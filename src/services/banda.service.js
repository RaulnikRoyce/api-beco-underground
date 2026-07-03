// src/services/banda.service.js
const bandaRepository = require('../repositories/banda.repository');

exports.listarBandas = async () => {
    // Aqui no futuro podemos adicionar regras (ex: só listar bandas ativas)
    return await bandaRepository.buscarTodas();
};

exports.adicionarBanda = async (dadosBanda) => {
    // Aqui no futuro entrará a validação do Zod (ex: impedir cachê negativo)
    return await bandaRepository.salvar(dadosBanda);
};