// src/controllers/lineup.controller.js
const lineupService = require('../services/lineup.service');

exports.adicionarBanda = async (req, res) => {
    try {
        const { evento_id, banda_id, horario, cache_negociado } = req.body;
        const novaEscalacao = await lineupService.adicionarNaLineup(evento_id, banda_id, horario, cache_negociado);
        res.status(201).json({ mensagem: 'Banda escalada com sucesso!', lineup: novaEscalacao });
    } catch (error) {
        console.error("Erro ao escalar banda:", error);
        res.status(500).json({ erro: 'Erro interno ao adicionar banda no line-up' });
    }
};

exports.listarLineup = async (req, res) => {
    try {
        const lineup = await lineupService.listarLineupDoEvento(req.params.evento_id);
        res.json(lineup);
    } catch (error) {
        console.error("Erro ao buscar line-up:", error);
        res.status(500).json({ erro: 'Erro interno ao buscar o line-up' });
    }
};