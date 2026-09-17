const test = require('node:test');
const assert = require('node:assert/strict');

const limitador = require('../src/utils/limitador-login');

test('bloqueia a conta depois de MAX_TENTATIVAS falhas, não antes', () => {
    const email = 'conta-teste-1@exemplo.com';
    for (let i = 0; i < limitador.MAX_TENTATIVAS - 1; i += 1) {
        limitador.registrarFalha(email);
        assert.equal(limitador.bloqueado(email), false, `não deveria bloquear na tentativa ${i + 1}`);
    }
    limitador.registrarFalha(email);
    assert.equal(limitador.bloqueado(email), true);
});

test('login bem-sucedido limpa as tentativas anteriores', () => {
    const email = 'conta-teste-2@exemplo.com';
    for (let i = 0; i < limitador.MAX_TENTATIVAS; i += 1) limitador.registrarFalha(email);
    assert.equal(limitador.bloqueado(email), true);

    limitador.limparTentativas(email);
    assert.equal(limitador.bloqueado(email), false);
});

test('e-mail é normalizado (case-insensitive, sem espaços) pra trava valer igual', () => {
    const base = 'Conta-Teste-3@Exemplo.com';
    for (let i = 0; i < limitador.MAX_TENTATIVAS; i += 1) limitador.registrarFalha(base);
    assert.equal(limitador.bloqueado('  conta-teste-3@exemplo.com  '), true);
});

test('contas diferentes têm contadores independentes', () => {
    const a = 'conta-teste-4a@exemplo.com';
    const b = 'conta-teste-4b@exemplo.com';
    for (let i = 0; i < limitador.MAX_TENTATIVAS; i += 1) limitador.registrarFalha(a);
    assert.equal(limitador.bloqueado(a), true);
    assert.equal(limitador.bloqueado(b), false);
});
