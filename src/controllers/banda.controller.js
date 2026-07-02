const bandaService = require('../services/banda.service');

exports.listarBandas = async (req, res) => {
    try {
        const bandas = await bandaService.buscarTodas();
        res.json(bandas);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar bandas' });
    }
};

exports.cadastrarBanda = async (req, res) => {
    try {
        const novaBanda = await bandaService.criar(req.body);
        res.status(201).json({ mensagem: 'Banda cadastrada com sucesso!', ...novaBanda });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao cadastrar banda' });
    }
};