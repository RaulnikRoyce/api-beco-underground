const { z } = require('zod');

exports.eventoSchema = z.object({
    nome: z.string().trim().min(3, 'Nome do evento deve ter no mínimo 3 caracteres'),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato YYYY-MM-DD'),
    local: z.string().trim().min(3, 'Local é obrigatório')
});

exports.eventoPatchSchema = exports.eventoSchema.partial().refine(
    (dados) => Object.keys(dados).length > 0,
    { message: 'Envie ao menos um campo para atualizar' }
);

exports.listarEventosQuery = z.object({
    q: z.string().trim().max(120).optional(),
    include: z.enum(['lineup']).optional(),
    ordenar: z.enum(['data_desc', 'data_asc', 'nome']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(50).optional()
});
