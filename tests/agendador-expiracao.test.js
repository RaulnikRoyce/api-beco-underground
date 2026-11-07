const test = require('node:test');
const assert = require('node:assert/strict');

const pedidoService = require('../src/services/pedido.service');
const agendador = require('../src/jobs/agendador-expiracao');

test.beforeEach((t) => { t.mock.method(pedidoService, 'retomarCancelamentos', async () => ({ concluidos: 0 })); });

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('agendador roda expirarReservas assim que inicia, e de novo no intervalo configurado', async () => {
    const original = pedidoService.expirarReservas;
    let chamadas = 0;
    pedidoService.expirarReservas = async () => { chamadas += 1; return { expirados: 0 }; };

    try {
        agendador.iniciar({ intervaloMs: 20 });
        await esperar(5);
        assert.equal(chamadas, 1, 'deve rodar assim que iniciar() é chamado, sem esperar o primeiro intervalo');

        await esperar(40);
        assert.ok(chamadas >= 2, 'deve rodar de novo depois do intervalo configurado');
    } finally {
        agendador.parar();
        pedidoService.expirarReservas = original;
    }
});

test('agendador não deixa o processo cair se expirarReservas falhar', async () => {
    const original = pedidoService.expirarReservas;
    pedidoService.expirarReservas = async () => { throw new Error('falha simulada'); };

    try {
        agendador.iniciar({ intervaloMs: 1000 });
        await esperar(5);
        assert.ok(true);
    } finally {
        agendador.parar();
        pedidoService.expirarReservas = original;
    }
});

test('iniciar() chamado duas vezes não cria dois intervalos', async () => {
    const original = pedidoService.expirarReservas;
    pedidoService.expirarReservas = async () => ({ expirados: 0 });

    try {
        const t1 = agendador.iniciar({ intervaloMs: 1000 });
        const t2 = agendador.iniciar({ intervaloMs: 1000 });
        assert.equal(t1, t2);
    } finally {
        agendador.parar();
        pedidoService.expirarReservas = original;
    }
});

test('retoma cancelamentos mesmo quando expiracao falha', async (t) => {
    t.mock.method(pedidoService, 'expirarReservas', async () => { throw new Error('falha simulada'); });
    let resolve;
    const called = new Promise((r) => { resolve = r; });
    t.mock.method(pedidoService, 'retomarCancelamentos', async () => { resolve(); return { concluidos: 1 }; });
    let timeout;
    try {
        agendador.iniciar({ intervaloMs: 10000 });
        await Promise.race([called, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('retomada nao executada')), 1000); })]);
    } finally {
        clearTimeout(timeout);
        agendador.parar();
    }
});
