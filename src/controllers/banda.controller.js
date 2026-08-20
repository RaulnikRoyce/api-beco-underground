const bandaService = require('../services/banda.service');

exports.listarBandas = async (req, res) => {
    try {
        const bandas = await bandaService.listarBandas();
        return res.json(bandas);
    } catch (error) {
        console.error('Erro ao listar bandas:', error);
        return res.status(500).json({ erro: 'Erro interno ao buscar as bandas' });
    }
};

exports.obterBandaPorId = async (req, res) => {
    try {
        const banda = await bandaService.obterBandaPorId(req.params.id);
        if (!banda) {
            return res.status(404).json({ erro: 'Banda não encontrada' });
        }
        return res.json(banda);
    } catch (error) {
        console.error('Erro ao buscar a banda:', error);
        return res.status(500).json({ erro: 'Erro interno ao buscar a banda' });
    }
};

exports.adicionarBanda = async (req, res) => {
    try {
        const novaBanda = await bandaService.adicionarBanda(req.body);
        return res.status(201).json({ mensagem: 'Banda cadastrada com sucesso!', banda: novaBanda });
    } catch (error) {
        console.error('Erro ao cadastrar banda:', error);
        return res.status(500).json({ erro: 'Erro interno ao cadastrar banda' });
    }
};

exports.removerBanda = async (req, res) => {
    try {
        const removida = await bandaService.removerBanda(req.params.id);
        if (!removida) {
            return res.status(404).json({ erro: 'Banda não encontrada' });
        }
        return res.json({ mensagem: 'Banda removida com sucesso!' });
    } catch (error) {
        console.error('Erro ao remover banda:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
            return res.status(409).json({
                erro: 'Não é possível excluir: a banda está escalada em um ou mais eventos.'
            });
        }
        return res.status(500).json({ erro: 'Erro interno ao remover banda' });
    }
};
