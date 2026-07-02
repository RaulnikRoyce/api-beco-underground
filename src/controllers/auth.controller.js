const authService = require('../services/auth.service');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        const usuario = await authService.autenticar(email, senha);
        
        if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });

        const token = jwt.sign({ id: usuario.id }, 'MINHA_CHAVE_SECRETA_MUITO_SEGURA', { expiresIn: '1h' });
        res.json({ mensagem: 'Login realizado!', token });
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
};

exports.registrar = async (req, res) => {
    try {
        await authService.registrar(req.body.email, req.body.senha);
        res.status(201).json({ mensagem: 'Usuário cadastrado!' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao cadastrar usuário' });
    }
};