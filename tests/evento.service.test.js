const test = require('node:test');
const assert = require('node:assert/strict');
const { podeExcluirEvento, agruparLineups } = require('../src/utils/evento.regras');
const { parsePaginacao, envelope } = require('../src/utils/paginacao');
const eventoService = require('../src/services/evento.service');
const eventoRepository = require('../src/repositories/evento.repository');
const pedidoRepository = require('../src/repositories/pedido.repository');

function mockar(objeto, metodo, implementacao) {
    const original = objeto[metodo];
    objeto[metodo] = implementacao;
    return () => { objeto[metodo] = original; };
}

test('excluirEvento recusa apagar evento com pedido pago', async () => {
    const restaurar = [
        mockar(eventoRepository, 'buscarPorId', async () => ({ id: 1, criado_por: 1 })),
        mockar(pedidoRepository, 'contarPedidosPagosPorEvento', async () => 3)
    ];

    try {
        await assert.rejects(
            eventoService.excluirEvento(1, { id: 1, perfil: 'admin' }),
            /3 pedido\(s\) pago\(s\)/
        );
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('excluirEvento apaga normalmente quando não há pedido pago', async () => {
    let excluiu = false;
    const restaurar = [
        mockar(eventoRepository, 'buscarPorId', async () => ({ id: 1, criado_por: 1 })),
        mockar(pedidoRepository, 'contarPedidosPagosPorEvento', async () => 0),
        mockar(eventoRepository, 'excluir', async () => { excluiu = true; return true; })
    ];

    try {
        await eventoService.excluirEvento(1, { id: 1, perfil: 'admin' });
        assert.equal(excluiu, true);
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('admin pode excluir qualquer evento', () => {
    const ok = podeExcluirEvento({ id: 1, criado_por: 99 }, { id: 2, perfil: 'admin' });
    assert.equal(ok, true);
});

test('produtor só exclui o próprio evento', () => {
    const dono = podeExcluirEvento({ id: 1, criado_por: 7 }, { id: 7, perfil: 'produtor' });
    const outro = podeExcluirEvento({ id: 1, criado_por: 7 }, { id: 8, perfil: 'produtor' });
    assert.equal(dono, true);
    assert.equal(outro, false);
});

test('editar evento usa a mesma regra da exclusão', () => {
    const { podeEditarEvento } = require('../src/utils/evento.regras');
    assert.equal(podeEditarEvento({ criado_por: 7 }, { id: 7, perfil: 'produtor' }), true);
    assert.equal(podeEditarEvento({ criado_por: 7 }, { id: 8, perfil: 'produtor' }), false);
    assert.equal(podeEditarEvento({ criado_por: 7 }, { id: 1, perfil: 'admin' }), true);
});

test('agrupa lineups pelo evento_id sem N+1', () => {
    const eventos = [{ id: 1, nome: 'A' }, { id: 2, nome: 'B' }];
    const itens = [
        { lineup_id: 10, evento_id: 1, nome: 'Banda X' },
        { lineup_id: 11, evento_id: 1, nome: 'Banda Y' }
    ];
    const resultado = agruparLineups(eventos, itens);
    assert.equal(resultado[0].lineup.length, 2);
    assert.equal(resultado[1].lineup.length, 0);
    assert.equal(resultado[0].lineup[0].nome, 'Banda X');
});

test('paginação limita e calcula offset', () => {
    const pagina1 = parsePaginacao({ page: '2', limit: '10' });
    assert.equal(pagina1.pagina, 2);
    assert.equal(pagina1.limite, 10);
    assert.equal(pagina1.offset, 10);
});

test('envelope de lista inclui meta', () => {
    const corpo = envelope([{ id: 1 }], 1, 20, 1);
    assert.equal(corpo.dados.length, 1);
    assert.equal(corpo.meta.total, 1);
    assert.equal(corpo.meta.paginas, 1);
});
