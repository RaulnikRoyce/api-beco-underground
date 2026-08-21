const lineupRepository = require('../repositories/lineup.repository');
const { AppError } = require('../utils/erros');
const { ehTokenPublico } = require('../utils/token.publico');
const { montarPaginaBanda } = require('../utils/publico.regras');

exports.obterPaginaBanda = async (token) => {
    if (!ehTokenPublico(token)) {
        throw new AppError(404, 'Link inválido');
    }

    const slot = await lineupRepository.buscarPorToken(token);
    if (!slot) throw new AppError(404, 'Link inválido');

    const palco = await lineupRepository.buscarPorEvento(slot.evento_id);
    return montarPaginaBanda(slot, palco);
};
