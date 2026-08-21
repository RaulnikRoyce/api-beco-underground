const eventoRepository = require('../repositories/evento.repository');
const lineupRepository = require('../repositories/lineup.repository');
const { AppError } = require('../utils/erros');
const { envelope } = require('../utils/paginacao');
const { podeExcluirEvento, agruparLineups } = require('../utils/evento.regras');

exports.podeExcluirEvento = podeExcluirEvento;
exports.agruparLineups = agruparLineups;

exports.listarEventos = async (query = {}) => {
    const { q, include, ordenar = 'data_desc', page, limit } = query;
    const paginar = Boolean(page);
    const limite = paginar ? Math.min(50, Number(limit) || 20) : undefined;
    const offset = paginar ? (Number(page) - 1) * limite : undefined;

    const eventos = await eventoRepository.buscarTodos({ q, ordenar, limite, offset });

    let lista = eventos;
    if (include === 'lineup' && eventos.length) {
        const lineups = await lineupRepository.buscarPorEventos(eventos.map((evento) => evento.id));
        lista = agruparLineups(eventos, lineups);
    }

    if (!paginar) return lista;

    const total = await eventoRepository.contar({ q });
    return envelope(lista, Number(page), limite, total);
};

exports.obterEventoPorId = (id) => eventoRepository.buscarPorId(id);

exports.adicionarEvento = (dados, usuario) =>
    eventoRepository.salvar({ ...dados, criado_por: usuario.id });

exports.excluirEvento = async (id, usuario) => {
    const evento = await eventoRepository.buscarPorId(id);
    if (!evento) throw new AppError(404, 'Evento não encontrado');

    if (!exports.podeExcluirEvento(evento, usuario)) {
        throw new AppError(403, 'Só o criador ou um admin pode excluir este evento');
    }

    await eventoRepository.excluir(id);
};
