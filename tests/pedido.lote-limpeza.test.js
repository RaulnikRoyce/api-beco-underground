const test = require('node:test');
const assert = require('node:assert/strict');

const pedidoRepository = require('../src/repositories/pedido.repository');
const db = require('../src/database/db');

test('limparVinculosLoteInativos roda os dois DELETEs na mesma transação (achado B3)', async () => {
    const chamadas = [];
    const original = db.comTransacao;
    db.comTransacao = async (trabalho) => trabalho(async (sql, params) => {
        chamadas.push(sql);
        return { affectedRows: params ? params.length : 0 };
    });

    try {
        const resultado = await pedidoRepository.limparVinculosLoteInativos(10);
        assert.equal(resultado, true);
        assert.equal(chamadas.length, 2);
        assert.match(chamadas[0], /DELETE ie FROM ingressos_emitidos/);
        assert.match(chamadas[1], /DELETE ip FROM itens_pedido/);
    } finally {
        db.comTransacao = original;
    }
});

test('limparVinculosLoteInativos propaga erro se o segundo DELETE falhar, sem sucesso parcial', async () => {
    const original = db.comTransacao;
    db.comTransacao = async (trabalho) => trabalho(async (sql) => {
        if (sql.includes('itens_pedido')) throw new Error('falha simulada no segundo delete');
        return { affectedRows: 1 };
    });

    try {
        await assert.rejects(
            pedidoRepository.limparVinculosLoteInativos(10),
            /falha simulada no segundo delete/
        );
    } finally {
        db.comTransacao = original;
    }
});
