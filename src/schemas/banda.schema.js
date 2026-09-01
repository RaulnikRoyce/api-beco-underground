const { z } = require('zod');

exports.bandaSchema = z.object({
    nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    genero: z.string().trim().optional().or(z.literal('')),
    contato: z.string().trim().max(120).optional().or(z.literal('')),
    descricao: z.string().trim().max(2000).optional().or(z.literal('')),
    cache_base: z.coerce.number().nonnegative('Cachê não pode ser negativo')
});

exports.bandaPatchSchema = z.object({
    nome: z.string().trim().min(2).optional(),
    genero: z.string().trim().max(100).optional().or(z.literal('')),
    contato: z.string().trim().max(120).optional().or(z.literal('')),
    descricao: z.string().trim().max(2000).optional().or(z.literal('')),
    cache_base: z.coerce.number().nonnegative().optional()
}).refine((d) => Object.keys(d).length > 0, { message: 'Informe ao menos um campo' });
