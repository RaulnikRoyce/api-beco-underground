const { z } = require('zod');

exports.loginSchema = z.object({
    email: z.string().email('E-mail inválido'),
    senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});

exports.registrarSchema = z.object({
    email: z.string().email('E-mail inválido'),
    senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});

exports.alterarUsuarioSchema = z.object({
    ativo: z.boolean()
});

exports.redefinirSenhaSchema = z.object({
    senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});

exports.trocarPropriaSenhaSchema = z.object({
    senha_atual: z.string().min(1, 'Informe a senha atual'),
    senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});
