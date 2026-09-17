const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { verificarToken, verificarPerfil } = require('../src/middlewares/auth.middleware');
const authRepository = require('../src/repositories/auth.repository');

function mockarBuscarPorId(implementacao) {
    const original = authRepository.buscarPorId;
    authRepository.buscarPorId = implementacao;
    return () => { authRepository.buscarPorId = original; };
}

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

test('aceita token válido, revalida no banco e popula req.usuario', async () => {
    const restaurar = mockarBuscarPorId(async (id) => ({ id, email: 'a@a.com', perfil: 'admin', ativo: 1 }));
    try {
        const token = jwt.sign({ id: 10, perfil: 'admin' }, 'test-secret', { expiresIn: '1h' });
        const req = { get: () => `Bearer ${token}` };
        const res = createResponse();
        let nextCalled = false;

        await verificarToken(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(req.usuario.id, 10);
        assert.equal(req.usuarioId, 10);
        assert.equal(res.statusCode, null);
    } finally {
        restaurar();
    }
});

test('token válido de conta desativada é recusado, mesmo sem estar expirado', async () => {
    const restaurar = mockarBuscarPorId(async (id) => ({ id, email: 'a@a.com', perfil: 'produtor', ativo: 0 }));
    try {
        const token = jwt.sign({ id: 10, perfil: 'produtor' }, 'test-secret', { expiresIn: '1h' });
        const req = { get: () => `Bearer ${token}` };
        const res = createResponse();
        let nextCalled = false;

        await verificarToken(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 401);
    } finally {
        restaurar();
    }
});

test('token de usuário excluído do banco é recusado', async () => {
    const restaurar = mockarBuscarPorId(async () => null);
    try {
        const token = jwt.sign({ id: 999, perfil: 'admin' }, 'test-secret', { expiresIn: '1h' });
        const req = { get: () => `Bearer ${token}` };
        const res = createResponse();
        let nextCalled = false;

        await verificarToken(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 401);
    } finally {
        restaurar();
    }
});

test('perfil no token desatualizado é ignorado — usa o perfil atual do banco', async () => {
    const restaurar = mockarBuscarPorId(async (id) => ({ id, email: 'a@a.com', perfil: 'admin', ativo: 1 }));
    try {
        const token = jwt.sign({ id: 10, perfil: 'produtor' }, 'test-secret', { expiresIn: '1h' });
        const req = { get: () => `Bearer ${token}` };
        const res = createResponse();

        await verificarToken(req, res, () => {});

        assert.equal(req.usuario.perfil, 'admin');
    } finally {
        restaurar();
    }
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
    const req = { usuario: { perfil: 'produtor' } };
    const res = createResponse();
    let nextCalled = false;

    verificarPerfil(['admin'])(req, res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
});

test('recusa token assinado com "alg: none" (achado B4)', async () => {
    const restaurar = mockarBuscarPorId(async (id) => ({ id, perfil: 'admin', ativo: 1 }));
    try {
        const payload = Buffer.from(JSON.stringify({ id: 1, perfil: 'admin' })).toString('base64url');
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const tokenSemAssinatura = `${header}.${payload}.`;
        const req = { get: () => `Bearer ${tokenSemAssinatura}` };
        const res = createResponse();
        let nextCalled = false;

        await verificarToken(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 401);
    } finally {
        restaurar();
    }
});
