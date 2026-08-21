const estaAtivo = (valor) => Number(valor) !== 0;

exports.contaAtiva = (usuario) => estaAtivo(usuario?.ativo);

exports.sanitizarUsuario = (usuario) => {
    if (!usuario) return null;
    return {
        id: usuario.id,
        email: usuario.email,
        perfil: usuario.perfil,
        ativo: estaAtivo(usuario.ativo)
    };
};

exports.podeAlterarAtivo = (alvo, ator, adminsAtivos, ativoNovo) => {
    if (!alvo) return 'Usuário não encontrado';
    if (Number(alvo.id) === Number(ator.id)) return 'Você não pode alterar o status da própria conta';
    if (alvo.perfil === 'admin' && estaAtivo(alvo.ativo) && !ativoNovo && adminsAtivos <= 1) {
        return 'Não é possível desativar o último admin';
    }
    return null;
};

exports.podeExcluirUsuario = (alvo, ator, adminsAtivos) => {
    if (!alvo) return 'Usuário não encontrado';
    if (Number(alvo.id) === Number(ator.id)) return 'Você não pode excluir a própria conta';
    if (alvo.perfil === 'admin' && adminsAtivos <= 1) return 'Não é possível excluir o último admin';
    return null;
};
