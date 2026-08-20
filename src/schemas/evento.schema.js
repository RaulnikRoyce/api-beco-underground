const { z } = require('zod');

exports.eventoSchema = z.object({
    nome: z.string().trim().min(3, 'O nome do evento precisa ter no mínimo 3 caracteres').max(150),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A data deve estar no formato YYYY-MM-DD'),
    local: z.string().trim().min(3, 'O local do evento é obrigatório').max(200)
});
