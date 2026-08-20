#!/usr/bin/env node
/**
 * Cria (ou atualiza) um usuário admin para desenvolvimento local.
 *
 * Uso:
 *   node scripts/seed-admin.js
 *   ADMIN_EMAIL=produtor@beco.local ADMIN_PASSWORD='SenhaForte123' node scripts/seed-admin.js
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../src/database/db');

const email = process.env.ADMIN_EMAIL || 'admin@beco.local';
const senha = process.env.ADMIN_PASSWORD || 'Admin123!';

async function main() {
    const hash = await bcrypt.hash(senha, 10);
    const sql = `
        INSERT INTO usuarios (email, senha, perfil)
        VALUES (?, ?, 'admin')
        ON DUPLICATE KEY UPDATE senha = VALUES(senha), perfil = 'admin'
    `;

    await db.promise().query(sql, [email, hash]);
    console.log(`Admin pronto: ${email}`);
    console.log('Use essa senha no login do frontend (variável ADMIN_PASSWORD se definida).');
}

main()
    .catch((error) => {
        console.error('Falha ao criar admin:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.promise().end();
    });
