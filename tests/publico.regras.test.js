const test = require('node:test');
const assert = require('node:assert/strict');
const { montarPaginaBanda } = require('../src/utils/publico.regras');
const { ehTokenPublico, gerarTokenPublico } = require('../src/utils/token.publico');

test('token público tem 32 hex', () => {
    const token = gerarTokenPublico();
    assert.equal(token.length, 32);
    assert.equal(ehTokenPublico(token), true);
    assert.equal(ehTokenPublico('abc'), false);
});

test('página da banda expõe só o próprio cachê', () => {
    const pagina = montarPaginaBanda(
        {
            lineup_id: 1,
            evento_nome: 'Sábado Maldito',
            evento_data: '2026-08-22',
            evento_local: 'Beco',
            nome: 'Banda A',
            horario: '23:00',
            cache: 800
        },
        [
            { lineup_id: 1, nome: 'Banda A', horario: '23:00', cache: 800 },
            { lineup_id: 2, nome: 'Banda B', horario: '00:30', cache: 1500 }
        ]
    );

    assert.equal(pagina.voce.cache, 800);
    assert.equal(pagina.lineup[1].nome, 'Banda B');
    assert.equal(pagina.lineup[1].voce, false);
    assert.equal(pagina.lineup[1].cache, undefined);
});
