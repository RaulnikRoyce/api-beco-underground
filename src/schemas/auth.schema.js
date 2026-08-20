const { z } = require('zod');

const email = z.string().trim().email('E-mail inválido.').max(254);
const senha = z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres.')
    .max(128)
    .regex(/[A-Za-z]/, 'A senha deve conter pelo menos uma letra.')
    .regex(/[0-9]/, 'A senha deve conter pelo menos um número.');

exports.loginSchema = z.object({
    email,
    senha: z.string().min(1, 'A senha é obrigatória.').max(128)
});

exports.registroSchema = z.object({
    email,
    senha
});
