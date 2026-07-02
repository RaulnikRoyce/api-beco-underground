const lineupService = require('../services/lineup.service');

exports.listarLineup = async (req, res) => {
    try {
        const lineup = await lineupService.buscarPorEvento(req.params.evento_id);
        res.json(lineup);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar line-up' });
    }
};

exports.adicionarAtraçao = async (req, res) => {
    try {
        const novaAtraçao = await lineupService.adicionar(req.body);
        res.status(201).json({ mensagem: 'Atração adicionada!', ...novaAtraçao });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao adicionar atração' });
    }
};