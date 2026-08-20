const mysql = require('mysql2');
require('dotenv').config();

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
    throw new Error(`Variáveis de banco não configuradas: ${missingEnv.join(', ')}`);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

pool.on('connection', () => {
    console.log('Conexão do pool com o banco do Beco Underground estabelecida.');
});

pool.promise().query('SELECT 1').catch((error) => {
    console.error('Falha ao validar a conexão com o banco de dados:', error.message);
});

module.exports = pool;
