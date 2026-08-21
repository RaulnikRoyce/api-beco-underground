function exigirEnv(nome) {
    const valor = process.env[nome];
    if (!valor || String(valor).trim() === '') {
        throw new Error(`Variável de ambiente obrigatória: ${nome}`);
    }
    return valor;
}

const carregarEnv = () => {
    exigirEnv('DB_HOST');
    exigirEnv('DB_USER');
    exigirEnv('DB_NAME');
    exigirEnv('JWT_SECRET');

    return {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: Number(process.env.PORT) || 3000,
        jwtSecret: process.env.JWT_SECRET,
        corsOrigin: process.env.CORS_ORIGIN || '',
        db: {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME,
            port: Number(process.env.DB_PORT) || 3306
        }
    };
};

module.exports = { carregarEnv, exigirEnv };
