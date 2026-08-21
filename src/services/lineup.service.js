const lineupRepository = require('../repositories/lineup.repository');
const db = require('../database/db');
const { AppError } = require('../utils/erros');

exports.adicionarNaLineup = (evento_id, banda_id, horario, cache_negociado) =>
    db.comTransacao(async (exec) => {
        const eventos = await exec('SELECT id FROM eventos WHERE id = ?', [evento_id]);
        if (!eventos.length) throw new AppError(404, 'Evento não encontrado');

        const bandas = await exec('SELECT id FROM bandas WHERE id = ?', [banda_id]);
        if (!bandas.length) throw new AppError(404, 'Banda não encontrada');

        const result = await exec(
            'INSERT INTO lineup (evento_id, banda_id, horario, cache_negociado) VALUES (?, ?, ?, ?)',
            [evento_id, banda_id, horario ?? null, cache_negociado ?? null]
        );

        return { id: result.insertId, evento_id, banda_id, horario, cache_negociado };
    });

exports.listarLineupDoEvento = (evento_id) => lineupRepository.buscarPorEvento(evento_id);
