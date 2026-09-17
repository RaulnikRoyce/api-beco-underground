const test = require('node:test');
const assert = require('node:assert/strict');

const authService = require('../src/services/auth.service');
const authRepository = require('../src/repositories/auth.repository');
const app = require('../src/app');

function mockar(objeto, metodo, implementacao) {
    const original = objeto[metodo];
    objeto[metodo] = implementacao;
    return () => { objeto[metodo] = original; };
}

async function comServidor(fn) {
    const server = app.listen(0);
    const { port } = server.address();
    try {
        await fn(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

test('registrar cria a conta quando o e-mail ainda não existe', async () => {
    const restaurar = [
        mockar(authRepository, 'buscarPorEmail', async () => null),
        mockar(authRepository, 'salvar', async (email) => ({ id: 1, email, perfil: 'produtor', ativo: 1 }))
    ];
    try {
        const usuario = await authService.registrar('novo@teste.com', 'senha-bem-comprida');
        assert.equal(usuario.email, 'novo@teste.com');
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('registrar não estoura e não cria de novo quando o e-mail já existe (achado M4)', async () => {
    let salvouDeNovo = false;
    const restaurar = [
        mockar(authRepository, 'buscarPorEmail', async () => ({ id: 1, email: 'ja@existe.com' })),
        mockar(authRepository, 'salvar', async () => { salvouDeNovo = true; })
    ];
    try {
        const resultado = await authService.registrar('ja@existe.com', 'senha-bem-comprida');
        assert.equal(resultado, null);
        assert.equal(salvouDeNovo, false);
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('registrar trata corrida de INSERT duplicado como "já existe", sem estourar', async () => {
    const restaurar = [
        mockar(authRepository, 'buscarPorEmail', async () => null),
        mockar(authRepository, 'salvar', async () => {
            const erro = new Error('Duplicate entry');
            erro.code = 'ER_DUP_ENTRY';
            throw erro;
        })
    ];
    try {
        const resultado = await authService.registrar('corrida@teste.com', 'senha-bem-comprida');
        assert.equal(resultado, null);
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('POST /auth/registrar devolve a mesma resposta (201) com e-mail novo ou já cadastrado', async () => {
    const jaExiste = mockar(authRepository, 'buscarPorEmail', async (email) => (
        email === 'existente@teste.com' ? { id: 1, email } : null
    ));
    const semSalvarDeVerdade = mockar(authRepository, 'salvar', async (email) => ({ id: 2, email, perfil: 'produtor', ativo: 1 }));

    try {
        await comServidor(async (base) => {
            const corpo = { email: 'novo2@teste.com', senha: 'senha-bem-comprida-123' };
            const r1 = await fetch(`${base}/auth/registrar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(corpo)
            });
            const r2 = await fetch(`${base}/auth/registrar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'existente@teste.com', senha: 'senha-bem-comprida-123' })
            });

            assert.equal(r1.status, r2.status, 'status precisa ser igual em ambos os casos');
            const [corpo1, corpo2] = await Promise.all([r1.json(), r2.json()]);
            assert.equal(corpo1.mensagem, corpo2.mensagem, 'mensagem precisa ser igual em ambos os casos');
        });
    } finally {
        jaExiste();
        semSalvarDeVerdade();
    }
});

test('POST /auth/registrar tem rate limit próprio, mais rígido que o de login (achado M12)', async () => {
    const semSalvarDeVerdade = [
        mockar(authRepository, 'buscarPorEmail', async () => null),
        mockar(authRepository, 'salvar', async (email) => ({ id: 1, email, perfil: 'produtor', ativo: 1 }))
    ];

    try {
        await comServidor(async (base) => {
            let ultimaResposta;
            for (let i = 0; i < 6; i += 1) {
                ultimaResposta = await fetch(`${base}/auth/registrar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: `spam${i}@teste.com`, senha: 'senha-bem-comprida-123' })
                });
            }
            assert.equal(ultimaResposta.status, 429, 'a 6ª tentativa no mesmo IP dentro da janela deveria ser bloqueada');
        });
    } finally {
        semSalvarDeVerdade.forEach((fn) => fn());
    }
});
