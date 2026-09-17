const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const authRepository = require('../src/repositories/auth.repository');

async function comServidor(fn) {
    const server = app.listen(0);
    const { port } = server.address();
    try {
        await fn(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

test('produtor não-admin recebe 403 em compradores, CSV e lista da porta (achado A3)', async () => {
    process.env.JWT_SECRET = 'segredo-rotas-teste';
    const original = authRepository.buscarPorId;
    authRepository.buscarPorId = async (id) => ({ id, email: 'produtor@teste.com', perfil: 'produtor', ativo: 1 });
    const token = jwt.sign({ id: 5, perfil: 'produtor' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    try {
        await comServidor(async (base) => {
            const rotas = [
                '/eventos/1/ingressos/compradores',
                '/eventos/1/ingressos/compradores.csv',
                '/eventos/1/ingressos/lista-porta.pdf'
            ];
            for (const caminho of rotas) {
                const resposta = await fetch(`${base}${caminho}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                assert.equal(resposta.status, 403, `${caminho} deveria recusar produtor não-admin`);
            }
        });
    } finally {
        authRepository.buscarPorId = original;
        delete process.env.JWT_SECRET;
    }
});
