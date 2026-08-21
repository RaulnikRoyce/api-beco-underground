const bandaRepository = require('../repositories/banda.repository');
const { AppError } = require('../utils/erros');

exports.listarBandas = () => bandaRepository.buscarTodas();
exports.obterBandaPorId = (id) => bandaRepository.buscarPorId(id);
exports.adicionarBanda = (dados) => bandaRepository.salvar(dados);

exports.excluirBanda = async (id) => {
    const banda = await bandaRepository.buscarPorId(id);
    if (!banda) throw new AppError(404, 'Banda não encontrada');
    return bandaRepository.excluir(id);
};
