const bcrypt = require('bcryptjs');
const authRepository = require('../repositories/auth.repository');
const { AppError } = require('../utils/erros');
const {
    contaAtiva,
    sanitizarUsuario,
    podeAlterarAtivo,
    podeExcluirUsuario
} = require('../utils/usuario.regras');

exports.autenticar = async (email, senha) => {
    const usuario = await authRepository.buscarPorEmail(email);
    if (!usuario) return null;

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return null;

    if (!contaAtiva(usuario)) {
        throw new AppError(403, 'Conta desativada. Fale com o administrador.');
    }

    return usuario;
};

exports.registrar = async (email, senha) => {
    const existente = await authRepository.buscarPorEmail(email);
    if (existente) {
        throw new AppError(409, 'E-mail já cadastrado');
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    return sanitizarUsuario(await authRepository.salvar(email, senhaCriptografada, 'produtor'));
};

exports.listarUsuarios = async () => {
    const lista = await authRepository.listar();
    return lista.map(sanitizarUsuario);
};

exports.definirAtivo = async (id, ativo, ator) => {
    const alvo = await authRepository.buscarPorId(id);
    const adminsAtivos = await authRepository.contarAdminsAtivos();
    const recusa = podeAlterarAtivo(alvo, ator, adminsAtivos, ativo);
    if (recusa) throw new AppError(alvo ? 403 : 404, recusa);

    await authRepository.atualizarAtivo(id, ativo);
    return sanitizarUsuario({ ...alvo, ativo: ativo ? 1 : 0 });
};

exports.excluirUsuario = async (id, ator) => {
    const alvo = await authRepository.buscarPorId(id);
    const adminsAtivos = await authRepository.contarAdminsAtivos();
    const recusa = podeExcluirUsuario(alvo, ator, adminsAtivos);
    if (recusa) throw new AppError(alvo ? 403 : 404, recusa);

    await authRepository.excluir(id);
};
