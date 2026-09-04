const eventoRepository = require('../repositories/evento.repository');
const lineupRepository = require('../repositories/lineup.repository');
const { AppError } = require('../utils/erros');
const { envelope } = require('../utils/paginacao');
const { podeExcluirEvento, podeEditarEvento, agruparLineups } = require('../utils/evento.regras');
const { gerarSlugBase, garantirSlugUnico } = require('../utils/slug');

exports.podeExcluirEvento = podeExcluirEvento;
exports.podeEditarEvento = podeEditarEvento;
exports.agruparLineups = agruparLineups;

exports.listarEventos = async (query = {}, usuario) => {
    const { q, include, ordenar = 'data_desc', page, limit } = query;
    const paginar = Boolean(page);
    const limite = paginar ? Math.min(50, Number(limit) || 20) : undefined;
    const offset = paginar ? (Number(page) - 1) * limite : undefined;

    const criadoPor = usuario?.perfil === 'admin' ? undefined : usuario?.id;
    const eventos = await eventoRepository.buscarTodos({ q, ordenar, limite, offset, criadoPor });

    let lista = eventos;
    if (include === 'lineup' && eventos.length) {
        const lineups = await lineupRepository.buscarPorEventos(eventos.map((evento) => evento.id));
        lista = agruparLineups(eventos, lineups);
    }

    if (!paginar) return lista;

    const total = await eventoRepository.contar({ q, criadoPor });
    return envelope(lista, Number(page), limite, total);
};

exports.obterEventoPorId = async (id, usuario) => {
    const evento = await eventoRepository.buscarPorId(id);
    if (!evento) return null;
    if (!podeEditarEvento(evento, usuario)) throw new AppError(403, 'Sem permissão para ver este evento');
    return evento;
};

exports.adicionarEvento = async (dados, usuario) => {
    const slug = await garantirSlugUnico(gerarSlugBase(dados.nome));
    return eventoRepository.salvar({ ...dados, criado_por: usuario.id, slug });
};

exports.excluirEvento = async (id, usuario) => {
    const evento = await eventoRepository.buscarPorId(id);
    if (!evento) throw new AppError(404, 'Evento não encontrado');

    if (!exports.podeExcluirEvento(evento, usuario)) {
        throw new AppError(403, 'Só o criador ou um admin pode excluir este evento');
    }

    await eventoRepository.excluir(id);
};

exports.atualizarEvento = async (id, dados, usuario) => {
    const evento = await eventoRepository.buscarPorId(id);
    if (!evento) throw new AppError(404, 'Evento não encontrado');

    if (!exports.podeEditarEvento(evento, usuario)) {
        throw new AppError(403, 'Só o criador ou um admin pode editar este evento');
    }

    return eventoRepository.atualizar(id, dados);
};
