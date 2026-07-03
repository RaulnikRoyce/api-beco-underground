// src/controllers/banda.controller.js
const bandaService = require('../services/banda.service');

exports.listarBandas = async (req, res) => {
    try {
        const bandas = await bandaService.listarBandas();
        res.json(bandas);
    } catch (error) {
        console.error("Erro ao listar bandas:", error);
        res.status(500).json({ erro: 'Erro interno ao buscar as bandas' });
    }
};

exports.adicionarBanda = async (req, res) => {
    try {
        // Envia os dados validados pelo Zod para o Service salvar
        const novaBanda = await bandaService.adicionarBanda(req.body);
        res.status(201).json({ mensagem: 'Banda adicionada com sucesso!', banda: novaBanda });
    } catch (error) {
        console.error("Erro ao adicionar banda:", error);
        res.status(500).json({ erro: 'Erro interno ao salvar a banda' });
    }
};