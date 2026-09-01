const path = require('path');
const { migrar } = require('../src/database/migrate');

const envDaSessao = Boolean(process.env.DB_HOST);
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({
    path: path.join(__dirname, '..', '.env.local'),
    override: !envDaSessao
});

const host = process.env.DB_HOST || '';

migrar({
    log: (mensagem) => console.log(`${mensagem} em ${process.env.DB_NAME} (${host})`)
}).catch((err) => {
    console.error('Erro na migração:', err.message);
    process.exit(1);
});
