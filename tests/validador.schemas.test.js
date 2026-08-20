const test = require('node:test');
const assert = require('node:assert/strict');
const { validarSchema } = require('../src/middlewares/validador');
const { eventoSchema } = require('../src/schemas/evento.schema');
const { bandaSchema } = require('../src/schemas/banda.schema');
const { lineupSchema } = require('../src/schemas/lineup.schema');
const { loginSchema, registroSchema } = require('../src/schemas/auth.schema');

const createResponse = () => {
    const response = {
        statusCode: null,
        body: null,
        status(code) {
            response.statusCode = code;
            return response;
        },
        json(body) {
            response.body = body;
            return response;
        }
    };
    return response;
};

const run = (schema, body) => {
    const req = { body };
    const res = createResponse();
    let nextCalled = false;
    validarSchema(schema)(req, res, () => {
        nextCalled = true;
    });
    return { req, res, nextCalled };
};

test('validador aceita evento válido e normaliza body', () => {
    const { req, res, nextCalled } = run(eventoSchema, {
        nome: '  Noite Hardcore  ',
        data: '2026-09-20',
        local: '  Subsolo SP  '
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
    assert.equal(req.body.nome, 'Noite Hardcore');
    assert.equal(req.body.local, 'Subsolo SP');
});

test('validador rejeita evento com data inválida', () => {
    const { res, nextCalled } = run(eventoSchema, {
        nome: 'Show',
        data: '20-09-2026',
        local: 'Casa'
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.erro, 'Dados inválidos.');
    assert.ok(Array.isArray(res.body.detalhes));
});

test('bandaSchema coerces cache_base string para number', () => {
    const { req, nextCalled } = run(bandaSchema, {
        nome: 'Ratos de Porão',
        genero: 'Hardcore',
        contato: 'contato@banda.local',
        cache_base: '1500'
    });

    assert.equal(nextCalled, true);
    assert.equal(req.body.cache_base, 1500);
});

test('lineupSchema exige horario HH:MM', () => {
    const { res, nextCalled } = run(lineupSchema, {
        evento_id: '1',
        banda_id: '2',
        horario: null
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
});

test('lineupSchema aceita payload coerente', () => {
    const { req, nextCalled } = run(lineupSchema, {
        evento_id: '3',
        banda_id: '7',
        horario: '22:30',
        cache_negociado: '800'
    });

    assert.equal(nextCalled, true);
    assert.equal(req.body.evento_id, 3);
    assert.equal(req.body.banda_id, 7);
    assert.equal(req.body.cache_negociado, 800);
});

test('loginSchema aceita credenciais mínimas', () => {
    const { nextCalled } = run(loginSchema, {
        email: 'admin@beco.local',
        senha: 'qualquer'
    });
    assert.equal(nextCalled, true);
});

test('registroSchema exige senha forte', () => {
    const fraca = run(registroSchema, {
        email: 'novo@beco.local',
        senha: 'abcdefg'
    });
    assert.equal(fraca.nextCalled, false);
    assert.equal(fraca.res.statusCode, 400);

    const forte = run(registroSchema, {
        email: 'novo@beco.local',
        senha: 'Senha1234'
    });
    assert.equal(forte.nextCalled, true);
});
