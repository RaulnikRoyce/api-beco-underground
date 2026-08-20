exports.validarSchema = (schema) => (req, res, next) => {
    const validacao = schema.safeParse(req.body);

    if (!validacao.success) {
        return res.status(400).json({
            erro: 'Dados inválidos.',
            detalhes: validacao.error.issues.map(({ path, message }) => ({
                campo: path.length > 0 ? path.join('.') : 'geral',
                mensagem: message
            }))
        });
    }

    req.body = validacao.data;
    return next();
};
