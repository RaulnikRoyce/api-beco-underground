const lineupRepository = require('../repositories/lineup.repository');
const db = require('../database/db');
const { AppError } = require('../utils/erros');
const { gerarTokenPublico } = require('../utils/token.publico');
const eventoRepository = require('../repositories/evento.repository');
const { podeEditarEvento } = require('../utils/evento.regras');

exports.adicionarNaLineup = (evento_id, banda_id, horario, cache_negociado) =>
    db.comTransacao(async (exec) => {
        const eventos = await exec('SELECT id FROM eventos WHERE id = ?', [evento_id]);
        if (!eventos.length) throw new AppError(404, 'Evento não encontrado');

        const bandas = await exec('SELECT id FROM bandas WHERE id = ?', [banda_id]);
        if (!bandas.length) throw new AppError(404, 'Banda não encontrada');

        const token_publico = gerarTokenPublico();
        const result = await exec(
            'INSERT INTO lineup (evento_id, banda_id, horario, cache_negociado, token_publico) VALUES (?, ?, ?, ?, ?)',
            [evento_id, banda_id, horario ?? null, cache_negociado ?? null, token_publico]
        );

        return { id: result.insertId, evento_id, banda_id, horario, cache_negociado, token: token_publico };
    });

exports.listarLineupDoEvento = async (evento_id, usuario) => {
    const evento = await eventoRepository.buscarPorId(evento_id);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!podeEditarEvento(evento, usuario)) throw new AppError(403, 'Sem permissão para ver esta lineup');
    return lineupRepository.buscarPorEvento(evento_id);
};

exports.atualizarSlot = async (id, dados) => {
    const slot = await lineupRepository.buscarPorId(id);
    if (!slot) throw new AppError(404, 'Escalação não encontrada');
    return lineupRepository.atualizar(id, dados);
};

exports.removerSlot = async (id) => {
    const slot = await lineupRepository.buscarPorId(id);
    if (!slot) throw new AppError(404, 'Escalação não encontrada');
    await lineupRepository.excluir(id);
};
