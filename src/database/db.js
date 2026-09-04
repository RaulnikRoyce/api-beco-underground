const dns = require('dns');
const mysql = require('mysql2');
const { usarSslMysql } = require('../config/mysql-ssl');

dns.setDefaultResultOrder('ipv4first');

const host = process.env.DB_HOST || '';
const usarSsl = usarSslMysql(host);
const porta = Number(process.env.DB_PORT) || 3306;

const pool = mysql.createPool({
    host,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: porta,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    ssl: usarSsl ? { rejectUnauthorized: true } : undefined
});

pool.on('error', (err) => {
    console.error(JSON.stringify({
        nivel: 'error',
        mensagem: 'Pool MySQL',
        detalhe: err.message,
        codigo: err.code,
        em: new Date().toISOString()
    }));
});

const tentarConexao = (tentativa) => {
    pool.getConnection((err, connection) => {
        if (!err) {
            console.log(JSON.stringify({
                nivel: 'info',
                mensagem: 'Banco conectado',
                host,
                porta,
                ssl: Boolean(usarSsl),
                em: new Date().toISOString()
            }));
            connection.release();
            return;
        }

        console.error(JSON.stringify({
            nivel: 'error',
            mensagem: 'Erro ao conectar no banco',
            detalhe: err.message,
            codigo: err.code,
            host,
            porta,
            ssl: Boolean(usarSsl),
            tentativa,
            em: new Date().toISOString()
        }));

        if (tentativa < 3) {
            setTimeout(() => tentarConexao(tentativa + 1), 2000 * tentativa);
        }
    });
};

if (process.env.NODE_ENV !== 'test') {
    tentarConexao(1);
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
