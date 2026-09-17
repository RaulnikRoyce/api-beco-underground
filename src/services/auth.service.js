const bcrypt = require('bcryptjs');
const authRepository = require('../repositories/auth.repository');
const { AppError } = require('../utils/erros');
const limitadorLogin = require('../utils/limitador-login');
const {
    contaAtiva,
    sanitizarUsuario,
    podeAlterarAtivo,
    podeExcluirUsuario,
    podeRedefinirSenha
} = require('../utils/usuario.regras');

const HASH_FANTASMA = bcrypt.hashSync('nenhuma-conta-usa-esta-senha', 10);

exports.autenticar = async (email, senha) => {
    if (limitadorLogin.bloqueado(email)) {
        throw new AppError(429, 'Muitas tentativas para esta conta. Aguarde alguns minutos e tente de novo.');
    }

    const usuario = await authRepository.buscarPorEmail(email);
    const senhaValida = await bcrypt.compare(senha, usuario ? usuario.senha : HASH_FANTASMA);

    if (!usuario || !senhaValida) {
        limitadorLogin.registrarFalha(email);
        return null;
    }

    limitadorLogin.limparTentativas(email);

    if (!contaAtiva(usuario)) {
        throw new AppError(403, 'Conta desativada. Fale com o administrador.');
    }

    return usuario;
};

exports.registrar = async (email, senha) => {
    const existente = await authRepository.buscarPorEmail(email);
    if (existente) return null;

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    try {
        return sanitizarUsuario(await authRepository.salvar(email, senhaCriptografada, 'produtor'));
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return null;
        throw err;
    }
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

exports.redefinirSenha = async (id, senha, ator) => {
    const alvo = await authRepository.buscarPorId(id);
    const recusa = podeRedefinirSenha(alvo, ator);
    if (recusa) throw new AppError(alvo ? 403 : 404, recusa);

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    await authRepository.atualizarSenha(id, senhaCriptografada);
    return sanitizarUsuario(alvo);
};

exports.trocarPropriaSenha = async (ator, senhaAtual, senhaNova) => {
    const usuario = await authRepository.buscarPorIdComSenha(ator.id);
    if (!usuario) throw new AppError(404, 'Usuário não encontrado');

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaValida) {
        throw new AppError(403, 'Senha atual incorreta');
    }

    const senhaCriptografada = await bcrypt.hash(senhaNova, 10);
    await authRepository.atualizarSenha(usuario.id, senhaCriptografada);
};
