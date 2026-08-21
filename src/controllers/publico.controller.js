const publicoService = require('../services/publico.service');
const { asyncHandler } = require('../utils/erros');
const { ok } = require('../utils/resposta');

exports.paginaBanda = asyncHandler(async (req, res) => {
    ok(res, await publicoService.obterPaginaBanda(req.params.token));
});
