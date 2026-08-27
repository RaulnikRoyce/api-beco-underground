const fs = require('fs');
const path = require('path');
const dns = require('dns');
const mysql = require('mysql2/promise');
const { usarSslMysql } = require('../src/config/mysql-ssl');

dns.setDefaultResultOrder('ipv4first');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const host = process.env.DB_HOST || '';
const porta = Number(process.env.DB_PORT) || 3306;
const usarSsl = usarSslMysql(host);

async function importar() {
    if (!host.includes('aivencloud.com')) {
        console.error(
            'Este import é para a Aiven. Defina DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME / DB_SSL nesta sessão do PowerShell.'
        );
        process.exit(1);
    }

    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema-cloud.sql'), 'utf8');
    const conn = await mysql.createConnection({
        host,
        port: porta,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: usarSsl ? { rejectUnauthorized: false } : undefined,
        multipleStatements: true
    });

    await conn.query(sql);
    await conn.end();
    console.log(`Tabelas criadas em ${process.env.DB_NAME} (${host})`);
}

importar().catch((err) => {
    console.error('Erro ao importar schema:', err.message);
    process.exit(1);
});
