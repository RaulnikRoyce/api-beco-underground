const test = require('node:test');
const assert = require('node:assert/strict');

const pedidoService = require('../src/services/pedido.service');
const pedidoRepository = require('../src/repositories/pedido.repository');
const cupomRepository = require('../src/repositories/cupom.repository');
const db = require('../src/database/db');

function mockar(objeto, metodo, implementacao) {
    const original = objeto[metodo];
    objeto[metodo] = implementacao;
    return () => { objeto[metodo] = original; };
}

test('expirarReservas libera estoque e cupom só dos pedidos que ainda estão pendentes', async () => {
    const loteLiberado = [];
    const cupomLiberado = [];

    const restaurar = [
        mockar(pedidoRepository, 'listarPedidosExpirados', async () => [
            { id: 1, evento_id: 10, cupom_id: 5 },
            { id: 2, evento_id: 10, cupom_id: null }
        ]),
        mockar(pedidoRepository, 'buscarItensPedido', async (pedidoId) => (
            pedidoId === 1 ? [{ lote_id: 100, quantidade: 2 }] : [{ lote_id: 200, quantidade: 1 }]
        )),
        mockar(pedidoRepository, 'liberarReservaLote', async (exec, loteId, quantidade) => {
            loteLiberado.push({ loteId, quantidade });
            return { affectedRows: 1 };
        }),
        mockar(cupomRepository, 'liberarUso', async (exec, cupomId) => {
            cupomLiberado.push(cupomId);
            return { affectedRows: 1 };
        }),
        mockar(db, 'comTransacao', async (trabalho) => trabalho(async (sql, params = []) => {
            if (sql.includes("status = 'expirado'")) {
                const [pedidoId] = params;
                return { affectedRows: pedidoId === 1 ? 1 : 0 };
            }
            return { affectedRows: 1 };
        }))
    ];

    try {
        const resultado = await pedidoService.expirarReservas();

        assert.equal(resultado.expirados, 1, 'só o pedido 1 foi de fato expirado');
        assert.deepEqual(loteLiberado, [{ loteId: 100, quantidade: 2 }]);
        assert.deepEqual(cupomLiberado, [5]);
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('expirarReservas não estoura se não houver nenhum pedido expirado', async () => {
    const restaurar = mockar(pedidoRepository, 'listarPedidosExpirados', async () => []);
    try {
        const resultado = await pedidoService.expirarReservas();
        assert.deepEqual(resultado, { expirados: 0 });
    } finally {
        restaurar();
    }
});
