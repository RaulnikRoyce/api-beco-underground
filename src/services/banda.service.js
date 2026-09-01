const bandaRepository = require('../repositories/banda.repository');
const { AppError } = require('../utils/erros');

exports.listarBandas = () => bandaRepository.buscarTodas();
exports.obterBandaPorId = (id) => bandaRepository.buscarPorId(id);
exports.adicionarBanda = (dados) => bandaRepository.salvar(dados);

exports.atualizarBanda = async (id, dados) => {
    const banda = await bandaRepository.buscarPorId(id);
    if (!banda) throw new AppError(404, 'Banda não encontrada');
    const atualizada = await bandaRepository.atualizar(id, dados);
    if (!atualizada) throw new AppError(400, 'Nenhum campo para atualizar');
    return atualizada;
};

exports.excluirBanda = async (id) => {
    const banda = await bandaRepository.buscarPorId(id);
    if (!banda) throw new AppError(404, 'Banda não encontrada');
    return bandaRepository.excluir(id);
};
