const bandaRepository = require('../repositories/banda.repository');
const { AppError } = require('../utils/erros');

const limitarDadosFinanceiros = (banda, usuario) => {
    if (!banda || usuario?.perfil === 'admin') return banda;
    const dadosPermitidos = { ...banda };
    delete dadosPermitidos.contato;
    delete dadosPermitidos.cache_base;
    return dadosPermitidos;
};

exports.listarBandas = async (usuario) => {
    const bandas = await bandaRepository.buscarTodas();
    return bandas.map((banda) => limitarDadosFinanceiros(banda, usuario));
};
exports.obterBandaPorId = async (id, usuario) => limitarDadosFinanceiros(
    await bandaRepository.buscarPorId(id),
    usuario
);
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
