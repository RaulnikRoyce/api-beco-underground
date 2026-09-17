const test = require('node:test');
const assert = require('node:assert/strict');
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

test('GET /ingressos/pedidos/:codigo tem rate limit dedicado (achado B7)', async () => {
    const original = pedidoService.obterPedidoPublico;
    pedidoService.obterPedidoPublico = async () => ({ pedido: {}, evento: {}, itens: [], ingressos: [] });

    try {
        await comServidor(async (base) => {
            let ultimaResposta;
            for (let i = 0; i < 61; i += 1) {
                ultimaResposta = await fetch(`${base}/ingressos/pedidos/codigo-de-teste`);
            }
            assert.equal(ultimaResposta.status, 429, 'a 61ª consulta no mesmo IP dentro da janela deveria ser bloqueada');
        });
    } finally {
        pedidoService.obterPedidoPublico = original;
    }
});
