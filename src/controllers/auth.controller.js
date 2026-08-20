const authService = require('../services/auth.service');
const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET não configurado.');
    }

    return secret;
};

exports.login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        const usuario = await authService.autenticar(email, senha);

        if (!usuario) {
            return res.status(401).json({ erro: 'Credenciais inválidas.' });
        }

        const token = jwt.sign(
            { id: usuario.id, perfil: usuario.perfil },
            getJwtSecret(),
            { expiresIn: '8h' }
        );

        return res.json({ mensagem: 'Login realizado com sucesso.', token });
    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
};

exports.registrar = async (req, res) => {
    try {
        await authService.registrar(req.body.email, req.body.senha);
        return res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso.' });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        return res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
};
