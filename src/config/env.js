function limpar(valor) {
    return String(valor || '').trim().replace(/^['"]|['"]$/g, '');
}

function primeiroDefinido(nomes) {
    for (const nome of nomes) {
        const valor = limpar(process.env[nome]);
        if (valor) return valor;
    }
    return '';
}

const parseMysqlUrl = (url) => {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parsed.port || '3306',
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: decodeURIComponent((parsed.pathname || '/').replace(/^\//, '').split('/')[0] || '')
    };
};

const carregarEnv = () => {
    const dbHost = primeiroDefinido(['DB_HOST']);
    const url = !dbHost ? primeiroDefinido(['DATABASE_URL', 'MYSQL_PUBLIC_URL']) : '';
    const doUrl = url.startsWith('mysql') ? parseMysqlUrl(url) : null;

    const hostFinal = dbHost || doUrl?.host || '';
    const dbUser = primeiroDefinido(['DB_USER', 'MYSQLUSER']) || doUrl?.user || '';
    const dbName = primeiroDefinido(['DB_NAME', 'MYSQLDATABASE', 'MYSQL_DATABASE']) || doUrl?.database || '';
    const dbPassword = primeiroDefinido(['DB_PASSWORD', 'MYSQLPASSWORD', 'MYSQL_ROOT_PASSWORD']) || doUrl?.password || '';
    const dbPort = primeiroDefinido(['DB_PORT']) || doUrl?.port || '3306';
    const jwtSecret = primeiroDefinido(['JWT_SECRET']);

    const faltando = [];
    if (!hostFinal) faltando.push('DB_HOST ou MYSQL_PUBLIC_URL');
    if (!dbUser) faltando.push('DB_USER');
    if (!dbName) faltando.push('DB_NAME');
    if (!jwtSecret) faltando.push('JWT_SECRET');

    if (faltando.length) {
        const soJwt = faltando.length === 1 && faltando[0] === 'JWT_SECRET';
        const dica = soJwt
            ? 'Coloque JWT_SECRET no .env (ou .env.local) da pasta api-eventos. Modelo em .env.example.'
            : 'Confira DB_HOST, DB_USER, DB_NAME, DB_PASSWORD, DB_PORT e JWT_SECRET no .env.';
        throw new Error(`Variável obrigatória ausente: ${faltando.join(', ')}. ${dica}`);
    }

    process.env.DB_HOST = hostFinal;
    process.env.DB_USER = dbUser;
    process.env.DB_NAME = dbName;
    process.env.DB_PASSWORD = dbPassword;
    process.env.DB_PORT = dbPort;
    process.env.JWT_SECRET = jwtSecret;

    return {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: Number(process.env.PORT) || 3000,
        dbHost: hostFinal,
        dbPort: Number(dbPort)
    };
};

module.exports = { carregarEnv, parseMysqlUrl, limpar };
