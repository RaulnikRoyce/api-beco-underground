const path = require('path');
const dns = require('dns');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { usarSslMysql } = require('../src/config/mysql-ssl');

dns.setDefaultResultOrder('ipv4first');

const envDaSessao = Boolean(process.env.DB_HOST);
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({
    path: path.join(__dirname, '..', '.env.local'),
    override: !envDaSessao
});

const host = process.env.DB_HOST || '';
const porta = Number(process.env.DB_PORT) || 3306;
const usarSsl = usarSslMysql(host);

const colunas = [
    {
        nome: 'usuarios.ativo',
        sql: 'ALTER TABLE usuarios ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1'
    },
    {
        nome: 'lineup.token_publico',
        sql: 'ALTER TABLE lineup ADD COLUMN token_publico VARCHAR(64) NULL UNIQUE'
    }
];

async function migrar() {
    const conn = await mysql.createConnection({
        host,
        port: porta,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: usarSsl ? { rejectUnauthorized: false } : undefined
    });

    try {
        for (const passo of colunas) {
            try {
                await conn.query(passo.sql);
                console.log(`Criado: ${passo.nome} em ${process.env.DB_NAME} (${host})`);
            } catch (err) {
                if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Já existe: ${passo.nome}`);
                } else {
                    throw err;
                }
            }
        }

        const [semToken] = await conn.query(
            'SELECT id FROM lineup WHERE token_publico IS NULL'
        );
        for (const row of semToken) {
            await conn.query('UPDATE lineup SET token_publico = ? WHERE id = ?', [
                crypto.randomBytes(16).toString('hex'),
                row.id
            ]);
        }
        if (semToken.length) {
            console.log(`Tokens gerados para ${semToken.length} escalação(ões)`);
        }
    } finally {
        await conn.end();
    }
}

migrar().catch((err) => {
    console.error('Erro na migração:', err.message);
    process.exit(1);
});
