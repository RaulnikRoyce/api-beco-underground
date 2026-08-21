const test = require('node:test');
const assert = require('node:assert/strict');
const { getJwtSecret } = require('../src/config/jwt');

test('getJwtSecret exige JWT_SECRET', () => {
    const anterior = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret(), /JWT_SECRET/);
    if (anterior) process.env.JWT_SECRET = anterior;
});

test('getJwtSecret devolve o valor do ambiente', () => {
    process.env.JWT_SECRET = 'segredo-de-teste';
    assert.equal(getJwtSecret(), 'segredo-de-teste');
});
