const path = require('path');
const dns = require('dns');
const mysql = require('mysql2/promise');

dns.setDefaultResultOrder('ipv4first');

const envDaSessao = Boolean(process.env.DB_HOST);
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({
    path: path.join(__dirname, '..', '.env.local'),
    override: !envDaSessao
});

const host = process.env.DB_HOST || '';
const porta = Number(process.env.DB_PORT) || 3306;
const usarSsl = process.env.DB_SSL === 'true' || host.includes('aivencloud.com');

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
        await conn.query(
            'ALTER TABLE usuarios ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1'
        );
        console.log(`Coluna ativo criada em ${process.env.DB_NAME} (${host})`);
    } catch (err) {
        if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
            console.log(`Coluna ativo já existe em ${process.env.DB_NAME} (${host})`);
        } else {
            throw err;
        }
    } finally {
        await conn.end();
    }
}

migrar().catch((err) => {
    console.error('Erro na migração:', err.message);
    process.exit(1);
});
