const dashboardRepository = require('../repositories/dashboard.repository');
const eventoRepository = require('../repositories/evento.repository');
const { AppError } = require('../utils/erros');
const { podeEditarEvento } = require('../utils/evento.regras');

exports.obterResumo = async (evento_id, usuario) => {
    const evento = await eventoRepository.buscarPorId(evento_id);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!podeEditarEvento(evento, usuario)) throw new AppError(403, 'Sem permissão');
    return dashboardRepository.obterResumoDoEvento(evento_id);
};
