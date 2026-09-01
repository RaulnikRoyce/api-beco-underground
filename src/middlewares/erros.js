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

    if (err.code === 'ER_TRUNCATED_WRONG_VALUE' || err.code === 'ER_WRONG_VALUE') {
        return res.status(400).json({ erro: 'Data ou valor inválido' });
    }

    if (err.code === 'ER_DUP_ENTRY') {
        const duplicadoEmail = String(err.sqlMessage || '').includes('usuarios');
        return res.status(409).json({
            erro: duplicadoEmail ? 'E-mail já cadastrado' : 'Registro duplicado'
        });
    }

    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
        const detalhe = `${err.sqlMessage || ''} ${req.originalUrl || ''}`.toLowerCase();
        const eLote = detalhe.includes('/lotes')
            || detalhe.includes('lotes_ingresso')
            || detalhe.includes('itens_pedido')
            || detalhe.includes('ingressos_emitidos');
        return res.status(409).json({
            erro: eLote
                ? 'Há pedidos ou ingressos neste lote. Cancele os pedidos antes de excluir.'
                : 'Banda escalada em eventos. Remova da lineup primeiro.'
        });
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
