const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

test('GET /publico/token-curto responde 404 sem ir ao banco', async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
        const resposta = await fetch(`http://127.0.0.1:${port}/publico/abc`);
        const corpo = await resposta.json();
        assert.equal(resposta.status, 404);
        assert.equal(corpo.erro, 'Link inválido');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
