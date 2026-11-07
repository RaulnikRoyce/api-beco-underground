const test = require('node:test');
const assert = require('node:assert/strict');

const pedidoService = require('../src/services/pedido.service');
const pedidoRepository = require('../src/repositories/pedido.repository');
const eventoRepository = require('../src/repositories/evento.repository');
const cupomRepository = require('../src/repositories/cupom.repository');
const mercadopagoService = require('../src/services/mercadopago.service');
const db = require('../src/database/db');

const cancelamentoRepository = require('../src/repositories/cancelamento.repository');
test.beforeEach((t) => {
    t.mock.method(cancelamentoRepository, 'preparar', async () => {});
    t.mock.method(cancelamentoRepository, 'assumir', async () => ({ pedido_id: 9, payment_id: '555', chave: 'chave-estorno-teste', lease_token: 'lease-teste' }));
    t.mock.method(cancelamentoRepository, 'liberar', async () => {});
    t.mock.method(cancelamentoRepository, 'concluir', async () => {});
    t.mock.method(pedidoRepository, 'buscarParaCancelamento', async () => ({ id: 9, status: 'pago', mp_payment_id: '555', cupom_id: null }));
});

const ADMIN = { id: 1, perfil: 'admin' };

function mockar(objeto, metodo, implementacao) {
    const original = objeto[metodo];
    objeto[metodo] = implementacao;
    return () => { objeto[metodo] = original; };
}

function mockarTransacao() {
    return mockar(db, 'comTransacao', async (trabalho) => trabalho(async (sql) => sql.startsWith('SELECT lease_token') ? [{ lease_token: 'lease-teste' }] : sql.startsWith('SELECT id') ? [{ id: 9 }] : { affectedRows: 1 }));
}

test('cancelar pedido pago estorna no Mercado Pago antes de mexer em estoque/ingresso', async () => {
    let estornado = null;
    let cancelado = false;
    const restaurar = [
        mockar(eventoRepository, 'buscarPorId', async () => ({ id: 1, criado_por: 1 })),
        mockar(pedidoRepository, 'buscarPorCodigoEEvento', async () => ({
            id: 9, status: 'pago', codigo_publico: 'abc', mp_payment_id: '555', cupom_id: null
        })),
        mockar(pedidoRepository, 'buscarItensPedido', async () => [{ lote_id: 1, quantidade: 2 }]),
        mockar(mercadopagoService, 'estornarPagamento', async (paymentId) => { estornado = paymentId; return { status: 'refunded' }; }),
        mockar(pedidoRepository, 'marcarCancelado', async () => { cancelado = true; return true; }),
        mockar(pedidoRepository, 'cancelarIngressosDoPedido', async () => 2),
        mockar(pedidoRepository, 'devolverVendaLote', async () => true),
        mockarTransacao()
    ];

    try {
        const resultado = await pedidoService.cancelarPedido(1, 'abc', ADMIN);
        assert.equal(estornado, '555');
        assert.equal(cancelado, true);
        assert.equal(resultado.status, 'cancelado');
        assert.equal(resultado.status_anterior, 'pago');
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('cancelar pedido pago não cancela nada se o estorno no Mercado Pago falhar', async () => {
    let cancelado = false;
    let ingressosCancelados = false;
    const restaurar = [
        mockar(eventoRepository, 'buscarPorId', async () => ({ id: 1, criado_por: 1 })),
        mockar(pedidoRepository, 'buscarPorCodigoEEvento', async () => ({
            id: 9, status: 'pago', codigo_publico: 'abc', mp_payment_id: '555', cupom_id: null
        })),
        mockar(pedidoRepository, 'buscarItensPedido', async () => [{ lote_id: 1, quantidade: 2 }]),
        mockar(mercadopagoService, 'estornarPagamento', async () => { throw new Error('MP fora do ar'); }),
        mockar(pedidoRepository, 'marcarCancelado', async () => { cancelado = true; return true; }),
        mockar(pedidoRepository, 'cancelarIngressosDoPedido', async () => { ingressosCancelados = true; return 2; })
    ];

    try {
        await assert.rejects(
            pedidoService.cancelarPedido(1, 'abc', ADMIN),
            /Não foi possível estornar/
        );
        assert.equal(cancelado, false, 'não pode marcar cancelado se o estorno falhou');
        assert.equal(ingressosCancelados, false, 'não pode cancelar ingresso se o estorno falhou');
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('cancelar pedido pendente não chama o Mercado Pago (nunca foi cobrado)', async () => {
    let chamouMp = false;
    let cancelado = false;
    const restaurar = [
        mockar(eventoRepository, 'buscarPorId', async () => ({ id: 1, criado_por: 1 })),
        mockar(pedidoRepository, 'buscarPorCodigoEEvento', async () => ({
            id: 9, status: 'pendente', codigo_publico: 'abc', mp_payment_id: null, cupom_id: null
        })),
        mockar(pedidoRepository, 'buscarItensPedido', async () => [{ lote_id: 1, quantidade: 1 }]),
        mockar(mercadopagoService, 'estornarPagamento', async () => { chamouMp = true; }),
        mockar(pedidoRepository, 'marcarCancelado', async () => { cancelado = true; return true; }),
        mockar(pedidoRepository, 'cancelarIngressosDoPedido', async () => 0),
        mockar(pedidoRepository, 'liberarReservaLote', async () => true),
        mockarTransacao()
    ];

    try {
        const resultado = await pedidoService.cancelarPedido(1, 'abc', ADMIN);
        assert.equal(chamouMp, false);
        assert.equal(cancelado, true);
        assert.equal(resultado.status_anterior, 'pendente');
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('falha no meio do cancelamento propaga o erro em vez de deixar estado parcial (achado M1)', async () => {
    const restaurar = [
        mockar(eventoRepository, 'buscarPorId', async () => ({ id: 1, criado_por: 1 })),
        mockar(pedidoRepository, 'buscarPorCodigoEEvento', async () => ({
            id: 9, status: 'pendente', codigo_publico: 'abc', mp_payment_id: null, cupom_id: null
        })),
        mockar(pedidoRepository, 'buscarItensPedido', async () => [{ lote_id: 1, quantidade: 1 }]),
        mockar(pedidoRepository, 'marcarCancelado', async () => true),
        mockar(pedidoRepository, 'cancelarIngressosDoPedido', async () => { throw new Error('falha de banco simulada'); }),
        mockarTransacao()
    ];

    try {
        await assert.rejects(
            pedidoService.cancelarPedido(1, 'abc', ADMIN),
            /falha de banco simulada/
        );
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('cancelar pedido pago sem mp_payment_id recusa em vez de perder o rastro do estorno', async () => {
    const restaurar = [
        mockar(eventoRepository, 'buscarPorId', async () => ({ id: 1, criado_por: 1 })),
        mockar(pedidoRepository, 'buscarPorCodigoEEvento', async () => ({
            id: 9, status: 'pago', codigo_publico: 'abc', mp_payment_id: null, cupom_id: null
        })),
        mockar(pedidoRepository, 'buscarItensPedido', async () => [{ lote_id: 1, quantidade: 1 }])
    ];

    try {
        await assert.rejects(
            pedidoService.cancelarPedido(1, 'abc', ADMIN),
            /estorno manual necessário/
        );
    } finally {
        restaurar.forEach((fn) => fn());
        void cupomRepository;
    }
});
