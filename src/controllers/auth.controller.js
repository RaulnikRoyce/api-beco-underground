// src/controllers/auth.controller.js
const authService = require('../services/auth.service');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        const usuario = await authService.autenticar(email, senha);
        
        if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });

        // INSERINDO O PERFIL AQUI: Agora o token carrega a informação de que você é admin
        const token = jwt.sign(
            { id: usuario.id, perfil: usuario.perfil }, 
            process.env.JWT_SECRET || 'MINHA_CHAVE_SECRETA_MUITO_SEGURA', 
            { expiresIn: '8h' }
        );
        
        res.json({ mensagem: 'Login realizado!', token });
    } catch (error) {
        console.error("ERRO DETALHADO NO LOGIN:", error); 
        res.status(500).json({ erro: 'Erro no servidor' });
    }
};

exports.registrar = async (req, res) => {
    try {
        await authService.registrar(req.body.email, req.body.senha);
        res.status(201).json({ mensagem: 'Usuário cadastrado!' });
    } catch (error) {
        console.error("ERRO AO CADASTRAR:", error);
        res.status(500).json({ erro: 'Erro ao cadastrar usuário' });
    }
};