const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { responderHealth } = require('../src/utils/saude');

const respostaFalsa = () => {
    const response = {
        statusCode: 200,
        body: null,
        status(code) {
            response.statusCode = code;
            return response;
        },
        json(body) {
            response.body = body;
            return response;
        }
    };
    return response;
};

test('GET /health responde ok', async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
        const resposta = await fetch(`http://127.0.0.1:${port}/health`);
        const corpo = await resposta.json();
        assert.equal(resposta.status, 200);
        assert.equal(corpo.status, 'ok');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('GET /openapi.json expõe o contrato', async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
        const resposta = await fetch(`http://127.0.0.1:${port}/openapi.json`);
        const corpo = await resposta.json();
        assert.equal(resposta.status, 200);
        assert.equal(corpo.info.title, 'API Beco Underground');
        assert.ok(corpo.paths['/auth/login']);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('GET /health devolve 503 se o banco falha', async () => {
    const handler = responderHealth(
        { query: (_sql, cb) => cb(new Error('ECONNREFUSED')) },
        { pularBanco: false }
    );
    const res = respostaFalsa();

    await handler({}, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.status, 'erro');
});
