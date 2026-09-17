const test = require('node:test');
const assert = require('node:assert/strict');

const ingressoService = require('../src/services/ingresso.service');
const ingressoRepository = require('../src/repositories/ingresso.repository');
const eventoRepository = require('../src/repositories/evento.repository');
const db = require('../src/database/db');

const ADMIN = { id: 1, perfil: 'admin' };

function mockar(objeto, metodo, implementacao) {
    const original = objeto[metodo];
    objeto[metodo] = implementacao;
    return () => { objeto[metodo] = original; };
}

test('venda na porta recusa a segunda venda concorrente quando só resta 1 vaga', async () => {
    const loteLido = {
        id: 10, evento_id: 1, nome: 'Porta', preco: 50,
        quantidade_total: 1, quantidade_vendida: 0, quantidade_reservada: 0,
        ativo: 1, ordem: 1, inicio_venda: null, fim_venda: null
    };

    let vendidaReal = 0;
    let proximoId = 1;

    const restaurar = [
        mockar(eventoRepository, 'buscarPorId', async () => ({ id: 1, criado_por: 1 })),
        mockar(ingressoRepository, 'buscarLotes', async () => [{ ...loteLido }]),
        mockar(ingressoRepository, 'buscarLotePorId', async () => ({ ...loteLido })),
        mockar(db, 'comTransacao', async (trabalho) => trabalho(async (sql, params = []) => {
            if (sql.includes('UPDATE lotes_ingresso') && sql.includes('quantidade_vendida = quantidade_vendida')) {
                const [qtd] = params;
                if (vendidaReal + qtd > loteLido.quantidade_total) return { affectedRows: 0 };
                vendidaReal += qtd;
                return { affectedRows: 1 };
            }
            return { affectedRows: 1, insertId: proximoId++ };
        }))
    ];

    try {
        const primeiro = await ingressoService.emitirVendaPorta(
            1, { nome: 'Cliente 1', quantidade: 1, lote_id: 10 }, ADMIN
        );
        assert.ok(primeiro.pedido_id);
        assert.equal(primeiro.ingressos.length, 1);
        assert.equal(vendidaReal, 1);

        await assert.rejects(
            ingressoService.emitirVendaPorta(1, { nome: 'Cliente 2', quantidade: 1, lote_id: 10 }, ADMIN),
            /Estoque insuficiente/
        );
        assert.equal(vendidaReal, 1, 'a segunda venda concorrente não pode ter incrementado o estoque vendido');
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('cortesia usa a mesma trava de estoque da venda na porta', async () => {
    const loteLido = {
        id: 11, evento_id: 1, nome: 'Cortesia', preco: 0,
        quantidade_total: 1, quantidade_vendida: 1, quantidade_reservada: 0,
        ativo: 1, ordem: 1, inicio_venda: null, fim_venda: null
    };

    const restaurar = [
        mockar(eventoRepository, 'buscarPorId', async () => ({ id: 1, criado_por: 1 })),
        mockar(ingressoRepository, 'buscarLotes', async () => [{ ...loteLido }]),
        mockar(ingressoRepository, 'buscarLotePorId', async () => ({ ...loteLido }))
    ];

    try {
        await assert.rejects(
            ingressoService.emitirCortesia(1, { nome: 'Convidado', quantidade: 1, lote_id: 11 }, ADMIN),
            /Estoque insuficiente/
        );
    } finally {
        restaurar.forEach((fn) => fn());
    }
});
