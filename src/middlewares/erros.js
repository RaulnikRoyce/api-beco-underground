const logger = require('../utils/logger');
const { AppError } = require('../utils/erros');

exports.manipularErros = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof AppError) {
        const corpo = { erro: err.message };
        if (err.detalhes) corpo.detalhes = err.detalhes;
        return res.status(err.status).json(corpo);
    }

    if (err.code === 'ER_DUP_ENTRY') {
        const duplicadoEmail = String(err.sqlMessage || '').includes('usuarios');
        return res.status(409).json({
            erro: duplicadoEmail ? 'E-mail já cadastrado' : 'Registro duplicado'
        });
    }

    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
        return res.status(409).json({ erro: 'Banda escalada em eventos. Remova da lineup primeiro.' });
    }

    logger.error('Erro não tratado', {
        rota: req.originalUrl,
        metodo: req.method,
        detalhe: err.message
    });

    return res.status(500).json({ erro: 'Erro interno do servidor' });
};

exports.rotaNaoEncontrada = (req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
};
