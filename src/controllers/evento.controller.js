const eventoService = require('../services/evento.service');

exports.listarEventos = async (req, res) => {
    try {
        const eventos = await eventoService.listarEventos();
        return res.json(eventos);
    } catch (error) {
        console.error('Erro ao listar eventos:', error);
        return res.status(500).json({ erro: 'Erro interno ao buscar os eventos' });
    }
};

exports.obterEventoPorId = async (req, res) => {
    try {
        const evento = await eventoService.obterEventoPorId(req.params.id);
        if (!evento) {
            return res.status(404).json({ erro: 'Evento não encontrado' });
        }
        return res.json(evento);
    } catch (error) {
        console.error('Erro ao buscar o evento:', error);
        return res.status(500).json({ erro: 'Erro interno ao buscar o evento' });
    }
};

exports.criarEvento = async (req, res) => {
    try {
        const evento = await eventoService.criarEvento(req.body);
        return res.status(201).json({ mensagem: 'Evento cadastrado com sucesso!', evento });
    } catch (error) {
        console.error('Erro ao cadastrar evento:', error);
        return res.status(500).json({ erro: 'Erro interno ao cadastrar evento' });
    }
};

exports.atualizarEvento = async (req, res) => {
    try {
        const evento = await eventoService.atualizarEvento(req.params.id, req.body);
        if (!evento) {
            return res.status(404).json({ erro: 'Evento não encontrado' });
        }
        return res.json({ mensagem: 'Evento atualizado com sucesso!', evento });
    } catch (error) {
        console.error('Erro ao atualizar evento:', error);
        return res.status(500).json({ erro: 'Erro interno ao atualizar evento' });
    }
};

exports.removerEvento = async (req, res) => {
    try {
        const removido = await eventoService.removerEvento(req.params.id);
        if (!removido) {
            return res.status(404).json({ erro: 'Evento não encontrado' });
        }
        return res.json({ mensagem: 'Evento removido com sucesso!' });
    } catch (error) {
        console.error('Erro ao remover evento:', error);
        return res.status(500).json({ erro: 'Erro interno ao remover evento' });
    }
};
