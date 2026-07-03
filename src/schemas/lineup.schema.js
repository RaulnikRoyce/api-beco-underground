// src/schemas/lineup.schema.js
const { z } = require('zod');

exports.lineupSchema = z.object({
    // Usamos coerce.number() para garantir que, mesmo se o frontend enviar como texto, o Zod converta para número
    evento_id: z.coerce.number().int().positive("O ID do evento é obrigatório"),
    banda_id: z.coerce.number().int().positive("O ID da banda é obrigatório"),
    horario: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "O horário deve estar no formato HH:MM (ex: 22:30)"),
    cache_negociado: z.coerce.number().nonnegative("O cachê não pode ser negativo").optional()
});