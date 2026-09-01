const test = require('node:test');
const assert = require('node:assert/strict');
const { pedidoSchema } = require('../src/schemas/pedido.schema');

test('pedido exige lgpd aceito', () => {
    const ok = pedidoSchema.safeParse({
        slug: 'show-teste',
        lote_id: 1,
        quantidade: 2,
        nome: 'Raul',
        email: 'raul@beco.com',
        lgpd: true
    });
    assert.equal(ok.success, true);
});

test('pedido recusa sem lgpd', () => {
    const bad = pedidoSchema.safeParse({
        slug: 'show',
        lote_id: 1,
        quantidade: 1,
        nome: 'Raul',
        email: 'raul@beco.com',
        lgpd: false
    });
    assert.equal(bad.success, false);
});
