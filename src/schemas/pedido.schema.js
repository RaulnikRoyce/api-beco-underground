const { z } = require('zod');

exports.pedidoSchema = z.object({
    evento_id: z.coerce.number().int().positive().optional(),
    slug: z.string().trim().min(2).max(120).optional(),
    lote_id: z.coerce.number().int().positive(),
    quantidade: z.coerce.number().int().positive().max(4),
    nome: z.string().trim().min(2).max(255),
    email: z.string().trim().email().max(255),
    cupom: z.string().trim().max(40).optional(),
    lgpd: z.literal(true, { message: 'Aceite a política de privacidade' })
}).refine(
    (d) => d.evento_id || d.slug,
    { message: 'Informe evento_id ou slug' }
);

exports.recuperarSchema = z.object({
    email: z.string().trim().email().max(255),
    codigo_pedido: z.string().trim().regex(/^[a-f0-9]{16}$/i, 'Código de pedido inválido')
});

exports.listaEsperaSchema = z.object({
    evento_id: z.coerce.number().int().positive(),
    email: z.string().trim().email().max(255)
});

exports.compradoresQuery = z.object({
    status: z.enum(['pendente', 'pago', 'expirado', 'cancelado']).optional(),
    canal: z.enum(['site', 'porta', 'cortesia']).optional(),
    lote_id: z.coerce.number().int().positive().optional()
});

exports.cupomSchema = z.object({
    codigo: z.string().trim().min(2).max(40),
    desconto_percentual: z.coerce.number().min(1).max(100),
    uso_max: z.coerce.number().int().positive().optional().nullable()
});
