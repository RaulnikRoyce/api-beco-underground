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
