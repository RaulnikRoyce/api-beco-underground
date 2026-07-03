// src/controllers/dashboard.controller.js
const dashboardService = require('../services/dashboard.service');

exports.carregarDashboard = async (req, res) => {
    try {
        const dados = await dashboardService.obterResumo(req.params.evento_id);
        res.json(dados);
    } catch (error) {
        console.error("Erro ao carregar os dados do dashboard:", error);
        res.status(500).json({ erro: 'Erro interno ao processar o painel' });
    }
};