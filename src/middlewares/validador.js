exports.validarSchema = (schema) => (req, res, next) => {
    const validacao = schema.safeParse(req.body);

    if (!validacao.success) {
        const listaErros = validacao.error.issues || validacao.error.errors || [];

        return res.status(400).json({
            erro: 'Dados inválidos',
            detalhes: listaErros.map((err) => ({
                campo: err.path[0] || 'geral',
                mensagem: err.message
            }))
        });
    }

    req.body = validacao.data;
    next();
};

exports.validarQuery = (schema) => (req, res, next) => {
    const validacao = schema.safeParse(req.query);

    if (!validacao.success) {
        const listaErros = validacao.error.issues || validacao.error.errors || [];

        return res.status(400).json({
            erro: 'Parâmetros inválidos',
            detalhes: listaErros.map((err) => ({
                campo: err.path[0] || 'geral',
                mensagem: err.message
            }))
        });
    }

    req.query = validacao.data;
    next();
};

exports.validarId = (parametro) => (req, res, next) => {
    const id = Number(req.params[parametro]);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ erro: 'ID inválido' });
    }
    req.params[parametro] = id;
    next();
};
