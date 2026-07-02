const eventoService = require('../services/evento.service');

exports.listarEventos = async (req, res) => {
    try {
        const eventos = await eventoService.buscarTodos();
        res.json(eventos);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao listar eventos' });
    }
};

exports.detalhesEvento = async (req, res) => {
    try {
        const evento = await eventoService.buscarPorId(req.params.id);
        if (!evento) return res.status(404).json({ erro: 'Evento não encontrado' });
        res.json(evento);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar evento' });
    }
};

exports.cadastrarEvento = async (req, res) => {
    try {
        const novoEvento = await eventoService.criar(req.body);
        res.status(201).json(novoEvento);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao criar evento' });
    }
};