const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const app = require('../src/app');
const pedidoService = require('../src/services/pedido.service');

async function comServidor(fn) {
    const server = app.listen(0);
    const { port } = server.address();
    try {
        await fn(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

function assinar(secret, { dataId, xRequestId, ts }) {
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    return `ts=${ts},v1=${v1}`;
}

test('webhook recusa assinatura inválida quando MP_WEBHOOK_SECRET está configurado', async () => {
    process.env.MP_WEBHOOK_SECRET = 'segredo-teste-webhook';
    const original = pedidoService.processarWebhook;
    let chamado = false;
    pedidoService.processarWebhook = async () => { chamado = true; return { ignorado: true }; };

    try {
        await comServidor(async (base) => {
            const resposta = await fetch(`${base}/ingressos/webhook?data.id=123`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-signature': 'ts=1700000000,v1=assinaturaforjada',
                    'x-request-id': 'req-1'
                },
                body: JSON.stringify({ data: { id: '123' } })
            });
            assert.equal(resposta.status, 401);
        });
        assert.equal(chamado, false, 'não pode processar o webhook com assinatura inválida');
    } finally {
        delete process.env.MP_WEBHOOK_SECRET;
        pedidoService.processarWebhook = original;
    }
});

test('webhook aceita assinatura válida quando MP_WEBHOOK_SECRET está configurado', async () => {
    process.env.MP_WEBHOOK_SECRET = 'segredo-teste-webhook';
    const original = pedidoService.processarWebhook;
    let chamado = false;
    pedidoService.processarWebhook = async () => { chamado = true; return { ignorado: true }; };

    const assinatura = assinar(process.env.MP_WEBHOOK_SECRET, { dataId: '123', xRequestId: 'req-1', ts: '1700000000' });

    try {
        await comServidor(async (base) => {
            const resposta = await fetch(`${base}/ingressos/webhook?data.id=123`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-signature': assinatura,
                    'x-request-id': 'req-1'
                },
                body: JSON.stringify({ data: { id: '123' } })
            });
            assert.equal(resposta.status, 200);
        });
        assert.equal(chamado, true);
    } finally {
        delete process.env.MP_WEBHOOK_SECRET;
        pedidoService.processarWebhook = original;
    }
});

test('webhook processa normalmente sem checar assinatura quando MP_WEBHOOK_SECRET não está configurado', async () => {
    delete process.env.MP_WEBHOOK_SECRET;
    const original = pedidoService.processarWebhook;
    let chamado = false;
    pedidoService.processarWebhook = async () => { chamado = true; return { ignorado: true }; };

    try {
        await comServidor(async (base) => {
            const resposta = await fetch(`${base}/ingressos/webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: { id: '123' } })
            });
            assert.equal(resposta.status, 200);
        });
        assert.equal(chamado, true);
    } finally {
        pedidoService.processarWebhook = original;
    }
});

for (const scenario of [
    { name: 'query somente', query: '?data.id=123', body: {}, status: 200 },
    { name: 'body somente', query: '', body: { data: { id: '123' } }, status: 200 },
    { name: 'id externo de notificacao', query: '?data.id=123', body: { id: 'notificacao', data: { id: '123' } }, status: 200 },
    { name: 'query e body divergentes', query: '?data.id=123', body: { data: { id: '456' } }, status: 400 },
    { name: 'queries divergentes', query: '?data.id=123&id=456', body: {}, status: 400 }
]) {
    test(`webhook usa o mesmo ID para assinatura e processamento: ${scenario.name}`, async (t) => {
        const original = process.env.MP_WEBHOOK_SECRET;
        process.env.MP_WEBHOOK_SECRET = 'segredo-ficticio';
        const processar = t.mock.method(pedidoService, 'processarWebhook', async (_body, id) => {
            assert.equal(id, '123');
            return { ignorado: true };
        });
        try {
            await comServidor(async (base) => {
                const response = await fetch(`${base}/ingressos/webhook${scenario.query}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-request-id': 'req-teste',
                        'x-signature': assinar('segredo-ficticio', { dataId: '123', xRequestId: 'req-teste', ts: '1700000000' })
                    },
                    body: JSON.stringify(scenario.body)
                });
                assert.equal(response.status, scenario.status);
                assert.equal(processar.mock.callCount(), scenario.status === 200 ? 1 : 0);
            });
        } finally {
            if (original === undefined) delete process.env.MP_WEBHOOK_SECRET;
            else process.env.MP_WEBHOOK_SECRET = original;
        }
    });
}
