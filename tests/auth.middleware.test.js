const jwt = require('jsonwebtoken');
const { verificarToken, verificarPerfil } = require('../src/middlewares/auth.middleware');

describe('auth.middleware', () => {
    const secret = 'test-secret';

    beforeEach(() => {
        process.env.JWT_SECRET = secret;
    });

    afterEach(() => {
        delete process.env.JWT_SECRET;
    });

    test('aceita um token válido e popula req.usuario', () => {
        const token = jwt.sign({ id: 10, perfil: 'admin' }, secret, { expiresIn: '1h' });
        const req = { get: () => `Bearer ${token}` };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        verificarToken(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.usuario.id).toBe(10);
        expect(req.usuarioId).toBe(10);
        expect(res.status).not.toHaveBeenCalled();
    });

    test('recusa requisição sem Bearer token', () => {
        const req = { get: () => undefined };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        verificarToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('recusa token inválido', () => {
        const req = { get: () => 'Bearer token-invalido' };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        verificarToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('permite perfil autorizado', () => {
        const req = { usuario: { perfil: 'admin' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        verificarPerfil(['admin'])(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test('bloqueia perfil não autorizado', () => {
        const req = { usuario: { perfil: 'usuario' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        verificarPerfil(['admin'])(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});
