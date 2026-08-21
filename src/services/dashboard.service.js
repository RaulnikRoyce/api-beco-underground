const dashboardRepository = require('../repositories/dashboard.repository');

exports.obterResumo = (evento_id) => dashboardRepository.obterResumoDoEvento(evento_id);
