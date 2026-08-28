const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMysqlUrl, limpar } = require('../src/config/env');
const { usarSslMysql } = require('../src/config/mysql-ssl');

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
