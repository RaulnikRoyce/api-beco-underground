const dashboardService = require('../services/dashboard.service');
const { asyncHandler } = require('../utils/erros');
const { ok } = require('../utils/resposta');

exports.carregarDashboard = asyncHandler(async (req, res) => {
    ok(res, await dashboardService.obterResumo(req.params.evento_id));
});
