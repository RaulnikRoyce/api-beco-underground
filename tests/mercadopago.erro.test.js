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

for (const scenario of [
    { name: 'confirmado', body: { status: 'approved', payment_id: 123 }, accepted: true },
    { name: 'pendente', body: { status: 'pending', payment_id: 123 }, accepted: false },
    { name: 'outro pagamento', body: { status: 'approved', payment_id: 456 }, accepted: false }
]) {
    test(`estorno ${scenario.name}: valida resposta e envia chave persistida`, async (t) => {
        const original = process.env.MP_ACCESS_TOKEN;
        process.env.MP_ACCESS_TOKEN = 'token-ficticio';
        t.mock.method(global, 'fetch', async (url, options) => {
            assert.equal(url, 'https://api.mercadopago.com/v1/payments/123/refunds');
            assert.equal(options.method, 'POST');
            assert.equal(options.headers['X-Idempotency-Key'], 'chave-persistida');
            assert.ok(options.signal instanceof AbortSignal);
            return { ok: true, json: async () => scenario.body };
        });
        try {
            const request = mercadopagoService.estornarPagamento('123', 'chave-persistida');
            if (scenario.accepted) assert.deepEqual(await request, scenario.body);
            else await assert.rejects(request, (err) => err.status === 502);
        } finally {
            if (original === undefined) delete process.env.MP_ACCESS_TOKEN;
            else process.env.MP_ACCESS_TOKEN = original;
        }
    });
}

test('estorno sem chave persistida recusa antes da rede', async (t) => {
    const fetch = t.mock.method(global, 'fetch', async () => { throw new Error('rede inesperada'); });
    await assert.rejects(mercadopagoService.estornarPagamento('123'), /chave de idempotência/);
    assert.equal(fetch.mock.callCount(), 0);
});
