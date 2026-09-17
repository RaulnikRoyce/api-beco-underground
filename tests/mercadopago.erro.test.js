const test = require('node:test');
const assert = require('node:assert/strict');

const mercadopagoService = require('../src/services/mercadopago.service');

test('erro do Mercado Pago não repassa o texto do terceiro pro cliente (achado B8)', async () => {
    process.env.MP_ACCESS_TOKEN = 'token-teste';
    const originalFetch = global.fetch;
    global.fetch = async () => ({
        ok: false,
        status: 400,
        json: async () => ({ message: 'invalid access token or detalhe interno sensível da conta MP' })
    });

    try {
        await assert.rejects(
            mercadopagoService.criarPreferencia({
                titulo: 'Show', quantidade: 1, total: 10, codigoPedido: 'abc123',
                email: 'a@a.com', lojaUrl: 'https://loja.test', apiUrl: 'https://api.test'
            }),
            (erro) => {
                assert.doesNotMatch(erro.message, /invalid access token|sensível/);
                assert.equal(erro.status, 502);
                return true;
            }
        );
    } finally {
        global.fetch = originalFetch;
        delete process.env.MP_ACCESS_TOKEN;
    }
});
