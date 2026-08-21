const test = require('node:test');
const assert = require('node:assert/strict');
const {
    contaAtiva,
    sanitizarUsuario,
    podeAlterarAtivo,
    podeExcluirUsuario
} = require('../src/utils/usuario.regras');

test('conta ativa ignora TinyInt 1', () => {
    assert.equal(contaAtiva({ ativo: 1 }), true);
    assert.equal(contaAtiva({ ativo: 0 }), false);
});

test('sanitizarUsuario não expõe senha', () => {
    const limpo = sanitizarUsuario({
        id: 2,
        email: 'a@beco.com',
        perfil: 'produtor',
        senha: 'hash',
        ativo: 1
    });
    assert.equal(limpo.senha, undefined);
    assert.equal(limpo.ativo, true);
});

test('admin não desativa a própria conta', () => {
    const recusa = podeAlterarAtivo(
        { id: 1, perfil: 'admin', ativo: 1 },
        { id: 1 },
        1,
        false
    );
    assert.equal(recusa, 'Você não pode alterar o status da própria conta');
});

test('não desativa o último admin', () => {
    const recusa = podeAlterarAtivo(
        { id: 2, perfil: 'admin', ativo: 1 },
        { id: 1 },
        1,
        false
    );
    assert.equal(recusa, 'Não é possível desativar o último admin');
});

test('admin pode desativar produtor', () => {
    const recusa = podeAlterarAtivo(
        { id: 3, perfil: 'produtor', ativo: 1 },
        { id: 1 },
        1,
        false
    );
    assert.equal(recusa, null);
});

test('não exclui a própria conta nem o último admin', () => {
    assert.equal(
        podeExcluirUsuario({ id: 1, perfil: 'admin' }, { id: 1 }, 1),
        'Você não pode excluir a própria conta'
    );
    assert.equal(
        podeExcluirUsuario({ id: 2, perfil: 'admin' }, { id: 1 }, 1),
        'Não é possível excluir o último admin'
    );
});
