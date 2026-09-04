const { z } = require('zod');

const valorPositivo = z.coerce.number().positive('Valor deve ser maior que zero');
const inteiroPositivo = z.coerce.number().int().positive('Quantidade deve ser maior que zero');

exports.custoSchema = z.object({
    descricao: z.string().trim().min(2, 'Descrição obrigatória'),
    categoria: z.string().trim().max(80).optional().nullable(),
    valor: valorPositivo
});

exports.custoPatchSchema = exports.custoSchema.partial().refine(
    (dados) => Object.keys(dados).length > 0,
    { message: 'Envie ao menos um campo para atualizar' }
);

exports.loteSchema = z.object({
    nome: z.string().trim().min(2, 'Nome do lote obrigatório'),
    preco: valorPositivo,
    quantidade_total: inteiroPositivo,
    ordem: z.coerce.number().int().min(0).optional(),
    inicio_venda: z.string().optional().nullable(),
    fim_venda: z.string().optional().nullable(),
    ativo: z.coerce.number().int().min(0).max(1).optional()
});

exports.lotePatchSchema = exports.loteSchema.partial().refine(
    (dados) => Object.keys(dados).length > 0,
    { message: 'Envie ao menos um campo para atualizar' }
);

exports.configIngressoSchema = z.object({
    slug: z.string().trim().min(2).max(120).optional(),
    publico_esperado: z.coerce.number().int().positive().optional().nullable(),
    capacidade_maxima: z.coerce.number().int().positive().optional().nullable(),
    margem_percentual: z.coerce.number().min(0).max(500).optional().nullable(),
    taxa_mp_percentual: z.coerce.number().min(0).max(100).optional().nullable(),
    repassa_taxa_comprador: z.coerce.number().int().min(0).max(1).optional()
}).refine(
    (dados) => Object.keys(dados).length > 0,
    { message: 'Envie ao menos um campo para atualizar' }
);

exports.publicarSchema = z.object({
    publicado: z.coerce.boolean().optional().default(true)
});

exports.cortesiaSchema = z.object({
    lote_id: z.coerce.number().int().positive(),
    nome: z.string().trim().min(2),
    email: z.string().trim().email(),
    quantidade: z.coerce.number().int().positive().max(10).optional().default(1)
});

exports.portaSchema = z.object({
    lote_id: z.coerce.number().int().positive().optional(),
    nome: z.string().trim().min(2),
    email: z.string().trim().email().optional().or(z.literal('')),
    quantidade: z.coerce.number().int().positive().max(10).optional().default(1)
});

exports.precificacaoQuery = z.object({
    percentual_vendido: z.coerce.number().min(1).max(100).optional(),
    preco_simulado: z.coerce.number().positive().optional()
});

exports.previewQuery = z.object({
    preview_token: z.string().trim().min(1).max(2048).optional()
});
