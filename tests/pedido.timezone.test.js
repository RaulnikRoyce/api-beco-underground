const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/database/db');
const pedidoRepository = require('../src/repositories/pedido.repository');

function mockarQuery(fn) {
    const original = db.query;
    db.query = fn;
    return () => { db.query = original; };
}

test('pool do MySQL fixa timezone UTC explicitamente na conversão de datas', () => {
    assert.equal(db.config.connectionConfig.timezone, 'Z');
});

test('listarPedidosExpirados compara com o relógio do Node, nunca com NOW() do MySQL', async () => {
    let sqlCapturado = null;
    let paramsCapturados = null;
    const restaurar = mockarQuery((sql, params, cb) => {
        sqlCapturado = sql;
        paramsCapturados = params;
        cb(null, []);
    });

    try {
        await pedidoRepository.listarPedidosExpirados();
        assert.doesNotMatch(sqlCapturado, /NOW\(\)/);
        assert.equal(paramsCapturados.length, 1);
        assert.ok(paramsCapturados[0] instanceof Date);
    } finally {
        restaurar();
    }
});

test('marcarPagamentoRecusado e marcarIngressoUsado gravam com Date explícito, não NOW()', async () => {
    const chamadas = [];
    const restaurar = mockarQuery((sql, params, cb) => {
        chamadas.push({ sql, params });
        cb(null, { affectedRows: 1 });
    });

    try {
        await pedidoRepository.marcarPagamentoRecusado(1);
        await pedidoRepository.marcarIngressoUsado('abc', 2);

        chamadas.forEach(({ sql, params }) => {
            assert.doesNotMatch(sql, /NOW\(\)/);
            assert.ok(params.some((p) => p instanceof Date), `esperava um Date entre os params de: ${sql}`);
        });
    } finally {
        restaurar();
    }
});
