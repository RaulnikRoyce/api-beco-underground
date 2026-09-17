const test = require('node:test');
const assert = require('node:assert/strict');

const pedidoService = require('../src/services/pedido.service');
const agendador = require('../src/jobs/agendador-expiracao');

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
