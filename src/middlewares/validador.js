// src/middlewares/validador.js
exports.validarSchema = (schema) => {
    return (req, res, next) => {
        const validacao = schema.safeParse(req.body);

        if (!validacao.success) {
            // Garante que vai encontrar a lista de erros, não importa a versão do Zod
            const listaErros = validacao.error.issues || validacao.error.errors || [];

            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: listaErros.map(err => ({ 
                    campo: err.path[0] || "geral", 
                    mensagem: err.message 
                }))
            });
        }

        req.body = validacao.data;
        next();
    };
};