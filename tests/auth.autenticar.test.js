const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const authService = require('../src/services/auth.service');
const authRepository = require('../src/repositories/auth.repository');
const limitadorLogin = require('../src/utils/limitador-login');

test('autenticar roda bcrypt.compare mesmo quando o e-mail não existe (achado M6)', async () => {
    const email = 'nao-existe-m6@exemplo.com';
    const restaurarBusca = mockar(authRepository, 'buscarPorEmail', async () => null);

    let chamadas = 0;
    const original = bcrypt.compare;
    bcrypt.compare = async (...args) => { chamadas += 1; return original(...args); };

    try {
        const resultado = await authService.autenticar(email, 'qualquer-coisa');
        assert.equal(resultado, null);
        assert.equal(chamadas, 1, 'bcrypt.compare precisa rodar mesmo pra e-mail inexistente, senão o tempo de resposta denuncia');
    } finally {
        bcrypt.compare = original;
        restaurarBusca();
        limitadorLogin.limparTentativas(email);
    }
});

function mockar(objeto, metodo, implementacao) {
    const original = objeto[metodo];
    objeto[metodo] = implementacao;
    return () => { objeto[metodo] = original; };
}

test('autenticar bloqueia por 429 depois de muitas tentativas erradas na mesma conta (achado M5)', async () => {
    const email = 'vitima-m5@exemplo.com';
    const senhaHash = await bcrypt.hash('senha-correta-123', 10);
    const restaurar = mockar(authRepository, 'buscarPorEmail', async () => ({
        id: 1, email, senha: senhaHash, perfil: 'produtor', ativo: 1
    }));

    try {
        for (let i = 0; i < limitadorLogin.MAX_TENTATIVAS; i += 1) {
            const resultado = await authService.autenticar(email, 'senha-errada');
            assert.equal(resultado, null);
        }
        await assert.rejects(
            authService.autenticar(email, 'senha-correta-123'),
            /Muitas tentativas/
        );
    } finally {
        restaurar();
        limitadorLogin.limparTentativas(email);
    }
});

test('autenticar com sucesso limpa o contador de tentativas da conta', async () => {
    const email = 'usuario-m5@exemplo.com';
    const senhaHash = await bcrypt.hash('senha-correta-123', 10);
    const restaurar = mockar(authRepository, 'buscarPorEmail', async () => ({
        id: 2, email, senha: senhaHash, perfil: 'produtor', ativo: 1
    }));

    try {
        for (let i = 0; i < limitadorLogin.MAX_TENTATIVAS - 1; i += 1) {
            await authService.autenticar(email, 'senha-errada');
        }
        const usuario = await authService.autenticar(email, 'senha-correta-123');
        assert.ok(usuario);
        assert.equal(limitadorLogin.bloqueado(email), false);
    } finally {
        restaurar();
        limitadorLogin.limparTentativas(email);
    }
});
