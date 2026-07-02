const dashboardService = require('../services/dashboard.service');

exports.carregarDashboard = async (req, res) => {
    try {
        const dados = await dashboardService.obterResumo(req.params.evento_id);
        res.json(dados);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao carregar os dados do dashboard' });
    }
};