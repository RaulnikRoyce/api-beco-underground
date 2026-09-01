const test = require('node:test');
const assert = require('node:assert/strict');
const { paraMysqlDatetime } = require('../src/utils/mysql-datetime');

test('paraMysqlDatetime converte ISO para formato MySQL', () => {
    assert.equal(
        paraMysqlDatetime('2026-09-01T03:00:00.000Z'),
        '2026-09-01 03:00:00'
    );
});

test('paraMysqlDatetime aceita datetime-local sem timezone', () => {
    assert.equal(
        paraMysqlDatetime('2026-09-01T00:00'),
        '2026-09-01 00:00:00'
    );
});

test('paraMysqlDatetime devolve null para vazio', () => {
    assert.equal(paraMysqlDatetime(null), null);
    assert.equal(paraMysqlDatetime(''), null);
});
