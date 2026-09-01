const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularPrecificacao, gerarLotesSugeridos, obterLoteVigente } = require('../src/services/ingresso.service');
const { gerarSlugBase } = require('../src/utils/slug');

test('precificação soma cachê e produção com margem', () => {
    const resultado = calcularPrecificacao({
        custoCaches: 5000,
        custoProducao: 1500,
        publicoEsperado: 200,
        margemPercentual: 15
    });

    assert.equal(resultado.custo_total, 6500);
    assert.equal(resultado.meta_receita, 7475);
    assert.equal(resultado.preco_sugerido, 35);
});

test('break-even usa preço do lote ativo', () => {
    const resultado = calcularPrecificacao({
        custoCaches: 1000,
        custoProducao: 0,
        publicoEsperado: 100,
        margemPercentual: 0,
        precoLoteAtivo: 25
    });

    assert.equal(resultado.break_even, 40);
});

test('simulador calcula sobra com percentual vendido', () => {
    const resultado = calcularPrecificacao({
        custoCaches: 2000,
        custoProducao: 0,
        publicoEsperado: 100,
        margemPercentual: 0,
        percentualVendido: 80,
        precoSimulado: 30
    });

    assert.equal(resultado.simulador.ingressos_vendidos, 80);
    assert.equal(resultado.simulador.receita, 2400);
    assert.equal(resultado.simulador.sobra, 400);
});

test('slug base remove acentos e espaços', () => {
    assert.equal(gerarSlugBase('Sábado Maldito #2'), 'sabado-maldito-2');
    assert.equal(gerarSlugBase(''), 'evento');
});

test('lotes sugeridos fracionam público 100 em 30/40/25/5', () => {
    const lotes = gerarLotesSugeridos({
        publicoEsperado: 100,
        metaReceita: 5000,
        precoMedioReferencia: 50
    });

    assert.equal(lotes.length, 4);
    assert.deepEqual(lotes.map((l) => l.quantidade_total), [30, 40, 25, 5]);
    assert.equal(lotes.reduce((s, l) => s + l.quantidade_total, 0), 100);
    assert.ok(lotes[0].preco < lotes[1].preco);
    assert.ok(lotes[1].preco < lotes[2].preco);
    assert.ok(lotes[2].preco < lotes[3].preco);
    lotes.forEach((l) => {
        assert.equal(l.preco % 5, 0, `preço ${l.preco} deve ser múltiplo de 5`);
    });
});

test('preço de ingresso arredonda para múltiplo de 5', () => {
    const { arredondarPrecoIngresso } = require('../src/utils/lote.regras');
    assert.equal(arredondarPrecoIngresso(13.2), 15);
    assert.equal(arredondarPrecoIngresso(16.49), 15);
    assert.equal(arredondarPrecoIngresso(20.62), 20);
    assert.equal(arredondarPrecoIngresso(22.5), 25);
    assert.equal(arredondarPrecoIngresso(2), 5);
});

test('lotes sugeridos recusam público baixo', () => {
    const lotes = gerarLotesSugeridos({
        publicoEsperado: 5,
        metaReceita: 5000,
        precoMedioReferencia: 1000
    });
    assert.equal(lotes.length, 0);
});

test('lote vigente respeita estoque e ordem', () => {
    const lotes = [
        { id: 1, ordem: 0, ativo: 1, quantidade_total: 10, quantidade_vendida: 10, quantidade_reservada: 0 },
        { id: 2, ordem: 1, ativo: 1, quantidade_total: 20, quantidade_vendida: 0, quantidade_reservada: 0 }
    ];
    const vigente = obterLoteVigente(lotes);
    assert.equal(vigente.id, 2);
});

test('lote vigente respeita fim_venda', () => {
    const agora = new Date('2026-06-15T12:00:00Z');
    const lotes = [
        {
            id: 1, ordem: 0, ativo: 1,
            quantidade_total: 10, quantidade_vendida: 0, quantidade_reservada: 0,
            fim_venda: '2026-06-01T00:00:00Z'
        },
        {
            id: 2, ordem: 1, ativo: 1,
            quantidade_total: 10, quantidade_vendida: 0, quantidade_reservada: 0,
            inicio_venda: null, fim_venda: null
        }
    ];
    const vigente = obterLoteVigente(lotes, agora);
    assert.equal(vigente.id, 2);
});
