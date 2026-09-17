const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMysqlUrl, limpar, carregarEnv } = require('../src/config/env');
const { usarSslMysql } = require('../src/config/mysql-ssl');

const VARS_PRODUCAO = [
    'NODE_ENV', 'DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD', 'JWT_SECRET', 'DB_SSL',
    'MP_ACCESS_TOKEN', 'CORS_ORIGIN', 'API_PUBLIC_URL', 'LOJA_INGRESSOS_URL'
];

function comEnvDeProducao(remover, fn) {
    const originais = {};
    VARS_PRODUCAO.forEach((nome) => { originais[nome] = process.env[nome]; });

    Object.assign(process.env, {
        NODE_ENV: 'production',
        DB_HOST: 'db.exemplo.test',
        DB_USER: 'user',
        DB_NAME: 'banco',
        DB_PASSWORD: 'senha-de-teste',
        JWT_SECRET: 'segredo-bem-comprido-para-teste',
        DB_SSL: 'true',
        MP_ACCESS_TOKEN: 'token-mp',
        CORS_ORIGIN: 'https://loja.exemplo.test',
        API_PUBLIC_URL: 'https://api.exemplo.test',
        LOJA_INGRESSOS_URL: 'https://loja.exemplo.test'
    });
    (remover || []).forEach((nome) => { delete process.env[nome]; });

    try {
        return fn();
    } finally {
        VARS_PRODUCAO.forEach((nome) => {
            if (originais[nome] === undefined) delete process.env[nome];
            else process.env[nome] = originais[nome];
        });
    }
}

test('parseMysqlUrl lê host público e porta do proxy', () => {
    const dados = parseMysqlUrl('mysql://root:s3nha@db.example.test:56321/beco_test');
    assert.equal(dados.host, 'db.example.test');
    assert.equal(dados.port, '56321');
    assert.equal(dados.user, 'root');
    assert.equal(dados.database, 'beco_test');
    assert.equal(dados.password, 's3nha');
});

test('limpar remove aspas acidentais', () => {
    assert.equal(limpar('  "56321"  '), '56321');
});

test('usarSslMysql liga SSL no host Aiven mesmo sem DB_SSL', () => {
    assert.equal(usarSslMysql('mysql-xxx.aivencloud.com', undefined), true);
    assert.equal(usarSslMysql('localhost', undefined), false);
    assert.equal(usarSslMysql('localhost', 'true'), true);
});

test('carregarEnv sobe normalmente em produção com tudo configurado', () => {
    comEnvDeProducao([], () => {
        assert.doesNotThrow(() => carregarEnv());
    });
});

test('carregarEnv recusa subir em produção sem MP_ACCESS_TOKEN, CORS_ORIGIN ou as URLs públicas', () => {
    comEnvDeProducao(['MP_ACCESS_TOKEN'], () => {
        assert.throws(() => carregarEnv(), /MP_ACCESS_TOKEN/);
    });
    comEnvDeProducao(['CORS_ORIGIN'], () => {
        assert.throws(() => carregarEnv(), /CORS_ORIGIN/);
    });
    comEnvDeProducao(['API_PUBLIC_URL'], () => {
        assert.throws(() => carregarEnv(), /API_PUBLIC_URL/);
    });
    comEnvDeProducao(['LOJA_INGRESSOS_URL'], () => {
        assert.throws(() => carregarEnv(), /LOJA_INGRESSOS_URL/);
    });
});

test('carregarEnv recusa subir em produção sem DB_PASSWORD (achado B6)', () => {
    comEnvDeProducao(['DB_PASSWORD'], () => {
        assert.throws(() => carregarEnv(), /DB_PASSWORD/);
    });
});

test('carregarEnv recusa subir em produção sem DB_SSL explícito, mesmo com host reconhecido (achado B5)', () => {
    comEnvDeProducao(['DB_SSL'], () => {
        assert.throws(() => carregarEnv(), /DB_SSL/);
    });
    comEnvDeProducao([], () => {
        process.env.DB_SSL = 'false';
        assert.doesNotThrow(() => carregarEnv());
    });
});

test('carregarEnv não exige MP_ACCESS_TOKEN/CORS_ORIGIN fora de produção', () => {
    const original = { NODE_ENV: process.env.NODE_ENV };
    process.env.NODE_ENV = 'development';
    process.env.DB_HOST = 'localhost';
    process.env.DB_USER = 'root';
    process.env.DB_NAME = 'beco';
    process.env.JWT_SECRET = 'segredo-dev';
    delete process.env.MP_ACCESS_TOKEN;
    delete process.env.CORS_ORIGIN;
    delete process.env.API_PUBLIC_URL;
    delete process.env.LOJA_INGRESSOS_URL;

    try {
        assert.doesNotThrow(() => carregarEnv());
    } finally {
        process.env.NODE_ENV = original.NODE_ENV;
        delete process.env.DB_HOST;
        delete process.env.DB_USER;
        delete process.env.DB_NAME;
        delete process.env.JWT_SECRET;
    }
});
