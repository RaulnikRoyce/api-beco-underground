// 1. Importando o tradutor do MySQL e o leitor do nosso arquivo .env
const mysql = require('mysql2');
require('dotenv').config();

// 2. Criando a configuração da conexão usando os dados do nosso "cofre"
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

// 3. Executando a tentativa de conexão
connection.connect((err) => {
    if (err) {
        console.error('Erro ao conectar no banco de dados:', err.message);
        return;
    }
    console.log('Conexão com o banco do Beco Underground estabelecida com sucesso!');
});

// 4. Exportando essa conexão para podermos usá-la em outros arquivos
module.exports = connection;