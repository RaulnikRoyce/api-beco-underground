const mysql = require('mysql2');
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

if (process.env.NODE_ENV !== 'test') {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error(JSON.stringify({
                nivel: 'error',
                mensagem: 'Erro ao conectar no banco',
                detalhe: err.message,
                em: new Date().toISOString()
            }));
            return;
        }
        console.log(JSON.stringify({
            nivel: 'info',
            mensagem: 'Banco conectado',
            em: new Date().toISOString()
        }));
        connection.release();
    });
}

pool.comTransacao = (trabalho) => new Promise((resolve, reject) => {
    pool.getConnection((err, conn) => {
        if (err) return reject(err);

        conn.beginTransaction((errTx) => {
            if (errTx) {
                conn.release();
                return reject(errTx);
            }

            const exec = (sql, params = []) => new Promise((ok, falha) => {
                conn.query(sql, params, (erroQuery, resultados) => {
                    if (erroQuery) return falha(erroQuery);
                    ok(resultados);
                });
            });

            Promise.resolve(trabalho(exec))
                .then((resultado) => {
                    conn.commit((erroCommit) => {
                        conn.release();
                        if (erroCommit) return reject(erroCommit);
                        resolve(resultado);
                    });
                })
                .catch((erroTrabalho) => {
                    conn.rollback(() => {
                        conn.release();
                        reject(erroTrabalho);
                    });
                });
        });
    });
});

module.exports = pool;
