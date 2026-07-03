// src/schemas/banda.schema.js
const { z } = require('zod');

exports.bandaSchema = z.object({
    nome: z.string().min(2, "O nome da banda deve ter pelo menos 2 caracteres"),
    genero: z.string().optional(),
    contato: z.string().email("O e-mail de contato é inválido").optional().or(z.literal('')),
    cache_base: z.number().nonnegative("O cachê não pode ser negativo")
});