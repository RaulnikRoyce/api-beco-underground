const lineupRepository = require('../repositories/lineup.repository');
const db = require('../database/db');
const { AppError } = require('../utils/erros');
const { gerarTokenPublico } = require('../utils/token.publico');

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

exports.listarLineupDoEvento = (evento_id) => lineupRepository.buscarPorEvento(evento_id);
