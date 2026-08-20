const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { verificarToken, verificarPerfil } = require('../src/middlewares/auth.middleware');

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

test.beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
});

test.afterEach(() => {
    delete process.env.JWT_SECRET;
});

test('aceita token válido e popula req.usuario', () => {
    const token = jwt.sign({ id: 10, perfil: 'admin' }, 'test-secret', { expiresIn: '1h' });
    const req = { get: () => `Bearer ${token}` };
    const res = createResponse();
    let nextCalled = false;

    verificarToken(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.usuario.id, 10);
    assert.equal(req.usuarioId, 10);
    assert.equal(res.statusCode, null);
});

test('recusa requisição sem Bearer token', () => {
    const req = { get: () => undefined };
    const res = createResponse();
    let nextCalled = false;

    verificarToken(req, res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
});

test('recusa token inválido', () => {
    const req = { get: () => 'Bearer token-invalido' };
    const res = createResponse();
    let nextCalled = false;

    verificarToken(req, res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
});

test('permite perfil autorizado', () => {
    const req = { usuario: { perfil: 'admin' } };
    const res = createResponse();
    let nextCalled = false;

    verificarPerfil(['admin'])(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
});

test('bloqueia perfil não autorizado', () => {
    const req = { usuario: { perfil: 'usuario' } };
    const res = createResponse();
    let nextCalled = false;

    verificarPerfil(['admin'])(req, res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
});
