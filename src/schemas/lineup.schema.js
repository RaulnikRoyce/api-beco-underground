const { z } = require('zod');

const horarioValor = z
    .union([
        z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário no formato HH:MM'),
        z.literal(''),
        z.null()
    ])
    .transform((valor) => (valor ? valor : null));

exports.lineupSchema = z.object({
    evento_id: z.coerce.number().int().positive('ID do evento inválido'),
    banda_id: z.coerce.number().int().positive('ID da banda inválido'),
    horario: horarioValor.optional(),
    cache_negociado: z.coerce.number().nonnegative('Cachê não pode ser negativo').optional().nullable()
});

exports.lineupPatchSchema = z.object({
    horario: horarioValor.optional(),
    cache_negociado: z.coerce.number().nonnegative('Cachê não pode ser negativo').optional().nullable()
}).refine(
    (dados) => dados.horario !== undefined || dados.cache_negociado !== undefined,
    { message: 'Envie horário ou cachê para atualizar' }
);
