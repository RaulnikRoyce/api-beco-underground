const test = require('node:test');
const assert = require('node:assert/strict');

const ingressoService = require('../src/services/ingresso.service');
const eventoRepository = require('../src/repositories/evento.repository');
const ingressoRepository = require('../src/repositories/ingresso.repository');

const ADMIN = { id: 1, perfil: 'admin' };

function mockar(objeto, metodo, implementacao) {
    const original = objeto[metodo];
    objeto[metodo] = implementacao;
    return () => { objeto[metodo] = original; };
}

test('atualizarConfig recusa slug só de números (achado B15)', async () => {
    const restaurar = [
        mockar(eventoRepository, 'buscarPorId', async () => ({ id: 1, criado_por: 1 })),
        mockar(ingressoRepository, 'slugEmUso', async () => false),
        mockar(ingressoRepository, 'atualizarConfigEvento', async () => ({ id: 1, slug: '123' }))
    ];

    try {
        await assert.rejects(
            ingressoService.atualizarConfig(1, { slug: '123' }, ADMIN),
            /Slug não pode ser só números/
        );
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('atualizarConfig aceita slug com pelo menos uma letra', async () => {
    let salvo = null;
    const restaurar = [
        mockar(eventoRepository, 'buscarPorId', async () => ({ id: 1, criado_por: 1 })),
        mockar(ingressoRepository, 'slugEmUso', async () => false),
        mockar(ingressoRepository, 'atualizarConfigEvento', async (id, dados) => { salvo = dados; return { id, ...dados }; })
    ];

    try {
        await ingressoService.atualizarConfig(1, { slug: 'show-123' }, ADMIN);
        assert.equal(salvo.slug, 'show-123');
    } finally {
        restaurar.forEach((fn) => fn());
    }
});
