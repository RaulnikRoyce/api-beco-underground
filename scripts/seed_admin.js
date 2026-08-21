const path = require('path');
const envDaSessao = Boolean(process.env.DB_HOST);

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({
    path: path.join(__dirname, '..', '.env.local'),
    override: !envDaSessao
});
const bcrypt = require('bcryptjs');
const db = require('../src/database/db');

const email = process.env.SEED_ADMIN_EMAIL || 'admin@beco.com';
const senha = process.env.SEED_ADMIN_PASSWORD || 'admin123';
const perfil = 'admin';

async function seed() {
    console.log(`Seed em ${process.env.DB_HOST} / ${process.env.DB_NAME}`);
    const hash = await bcrypt.hash(senha, 10);

    db.query('SELECT id FROM usuarios WHERE email = ?', [email], (err, rows) => {
        if (err) {
            console.error('Erro ao consultar usuário:', err.message);
            process.exit(1);
        }

        if (rows.length > 0) {
            db.query(
                'UPDATE usuarios SET senha = ?, perfil = ? WHERE email = ?',
                [hash, perfil, email],
                (updateErr) => {
                    if (updateErr) {
                        console.error('Erro ao atualizar admin:', updateErr.message);
                        process.exit(1);
                    }
                    console.log(`Admin atualizado: ${email}`);
                    process.exit(0);
                }
            );
            return;
        }

        db.query(
            'INSERT INTO usuarios (email, senha, perfil) VALUES (?, ?, ?)',
            [email, hash, perfil],
            (insertErr) => {
                if (insertErr) {
                    console.error('Erro ao criar admin:', insertErr.message);
                    process.exit(1);
                }
                console.log(`Admin criado: ${email}`);
                process.exit(0);
            }
        );
    });
}

seed();
