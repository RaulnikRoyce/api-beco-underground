const test = require('node:test');
const assert = require('node:assert/strict');
const { loteSchema, lotePatchSchema } = require('../src/schemas/ingresso.schema');

const BASE = { nome: 'Pista', quantidade_total: 100 };

test('loteSchema aceita preço com até 2 casas decimais (achado M11)', () => {
    assert.equal(loteSchema.safeParse({ ...BASE, preco: 45 }).success, true);
    assert.equal(loteSchema.safeParse({ ...BASE, preco: 45.5 }).success, true);
    assert.equal(loteSchema.safeParse({ ...BASE, preco: 45.99 }).success, true);
});

test('loteSchema recusa preço com mais de 2 casas decimais', () => {
    const resultado = loteSchema.safeParse({ ...BASE, preco: 45.333 });
    assert.equal(resultado.success, false);
    assert.match(resultado.error.issues[0].message, /2 casas decimais/);
});

test('lotePatchSchema (usado em atualizarLote) herda a mesma trava de casas decimais', () => {
    assert.equal(lotePatchSchema.safeParse({ preco: 19.999 }).success, false);
    assert.equal(lotePatchSchema.safeParse({ preco: 19.99 }).success, true);
});
