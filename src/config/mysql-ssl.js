const usarSslMysql = (host, dbSsl = process.env.DB_SSL) =>
    dbSsl === 'true' || /aivencloud\.com|\.aiven\.io/i.test(String(host || ''));

module.exports = { usarSslMysql };
