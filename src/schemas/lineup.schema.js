const { z } = require('zod');

const horarioSchema = z
    .union([
        z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário no formato HH:MM'),
        z.literal(''),
        z.null()
    ])
    .optional()
    .transform((valor) => (valor ? valor : null));

exports.lineupSchema = z.object({
    evento_id: z.coerce.number().int().positive('ID do evento inválido'),
    banda_id: z.coerce.number().int().positive('ID da banda inválido'),
    horario: horarioSchema,
    cache_negociado: z.coerce.number().nonnegative('Cachê não pode ser negativo').optional().nullable()
});
