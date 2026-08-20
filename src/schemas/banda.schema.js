const { z } = require('zod');

exports.bandaSchema = z.object({
    nome: z.string().trim().min(2, 'O nome da banda deve ter pelo menos 2 caracteres').max(150),
    genero: z.string().trim().max(100).optional().or(z.literal('')),
    contato: z
        .string()
        .trim()
        .max(254)
        .optional()
        .or(z.literal('')),
    cache_base: z.coerce.number().nonnegative('O cachê não pode ser negativo')
});
