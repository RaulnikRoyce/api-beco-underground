// src/services/dashboard.service.js
const dashboardRepository = require('../repositories/dashboard.repository');

exports.obterResumo = async (evento_id) => {
    // Regras de negócio futuras (ex: calcular margem de lucro de ingressos x cachês) entram aqui
    return await dashboardRepository.obterResumoDoEvento(evento_id);
};