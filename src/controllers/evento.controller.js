// src/controllers/evento.controller.js
const eventoService = require('../services/evento.service');

exports.listarEventos = async (req, res) => {
    try {
        const eventos = await eventoService.listarEventos();
        res.json(eventos);
    } catch (error) {
        console.error("Erro ao listar eventos:", error);
        res.status(500).json({ erro: 'Erro interno ao buscar os eventos' });
    }
};

exports.obterEventoPorId = async (req, res) => {
    try {
        const evento = await eventoService.obterEventoPorId(req.params.id);
        if (!evento) return res.status(404).json({ erro: 'Evento não encontrado' });
        res.json(evento);
    } catch (error) {
        console.error("Erro ao buscar o evento:", error);
        res.status(500).json({ erro: 'Erro interno ao buscar o evento' });
    }
};