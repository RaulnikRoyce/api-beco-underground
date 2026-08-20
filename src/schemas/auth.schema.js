const { z } = require('zod');

const email = z.string().trim().email('E-mail inválido.').max(254);
const senha = z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.').max(128);

exports.loginSchema = z.object({
    email,
    senha
});

exports.registroSchema = z.object({
    email,
    senha
});
