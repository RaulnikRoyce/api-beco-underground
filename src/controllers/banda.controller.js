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

// É ESTA A FUNÇÃO QUE O EXPRESS ESTAVA SENTINDO FALTA:
exports.obterBandaPorId = async (req, res) => {
    try {
        const banda = await bandaService.obterBandaPorId(req.params.id);
        if (!banda) return res.status(404).json({ erro: 'Banda não encontrada' });
        res.json(banda);
    } catch (error) {
        console.error("Erro ao buscar a banda:", error);
        res.status(500).json({ erro: 'Erro interno ao buscar a banda' });
    }
};

exports.adicionarBanda = async (req, res) => {
    try {
        const novaBanda = await bandaService.adicionarBanda(req.body);
        res.status(201).json({ mensagem: 'Banda cadastrada com sucesso!', banda: novaBanda });
    } catch (error) {
        console.error("Erro ao cadastrar banda:", error);
        res.status(500).json({ erro: 'Erro interno ao cadastrar banda' });
    }
};