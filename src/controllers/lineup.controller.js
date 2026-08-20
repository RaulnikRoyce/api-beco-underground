const lineupService = require('../services/lineup.service');

exports.adicionarBanda = async (req, res) => {
    try {
        const { evento_id, banda_id, horario, cache_negociado } = req.body;
        const novaEscalacao = await lineupService.adicionarNaLineup(
            evento_id,
            banda_id,
            horario,
            cache_negociado
        );
        return res.status(201).json({
            mensagem: 'Banda escalada com sucesso!',
            lineup: novaEscalacao
        });
    } catch (error) {
        console.error('Erro ao escalar banda:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: 'Esta banda já está escalada neste evento.' });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) {
            return res.status(400).json({ erro: 'Evento ou banda informados não existem.' });
        }
        return res.status(500).json({ erro: 'Erro interno ao adicionar banda no line-up' });
    }
};

exports.listarLineup = async (req, res) => {
    try {
        const lineup = await lineupService.listarLineupDoEvento(req.params.evento_id);
        return res.json(lineup);
    } catch (error) {
        console.error('Erro ao buscar line-up:', error);
        return res.status(500).json({ erro: 'Erro interno ao buscar o line-up' });
    }
};