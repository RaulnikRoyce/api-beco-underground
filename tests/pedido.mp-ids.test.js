const test = require('node:test');
const assert = require('node:assert/strict');

const pedidoRepository = require('../src/repositories/pedido.repository');
const db = require('../src/database/db');

function mockarQuery(fn) {
    const original = db.query;
    db.query = fn;
    return () => { db.query = original; };
}

test('salvarPreferenciaCriada grava em mp_preference_id, nunca em mp_payment_id (achado B14)', async () => {
    let sqlCapturado = null;
    const restaurar = mockarQuery((sql, params, cb) => {
        sqlCapturado = sql;
        cb(null, { affectedRows: 1 });
    });

    try {
        await pedidoRepository.salvarPreferenciaCriada(1, { preferenceId: 'pref-123', initPoint: 'https://mp.test/x' });
        assert.match(sqlCapturado, /mp_preference_id\s*=\s*\?/);
        assert.doesNotMatch(sqlCapturado, /\bmp_payment_id\s*=/);
    } finally {
        restaurar();
    }
});
