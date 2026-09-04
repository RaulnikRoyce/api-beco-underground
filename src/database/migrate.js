const dns = require('dns');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { usarSslMysql } = require('../config/mysql-ssl');
const { gerarSlugBase } = require('../utils/slug');

dns.setDefaultResultOrder('ipv4first');

const colunas = [
    {
        nome: 'usuarios.ativo',
        sql: 'ALTER TABLE usuarios ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1'
    },
    {
        nome: 'lineup.token_publico',
        sql: 'ALTER TABLE lineup ADD COLUMN token_publico VARCHAR(64) NULL UNIQUE'
    },
    {
        nome: 'eventos.slug',
        sql: 'ALTER TABLE eventos ADD COLUMN slug VARCHAR(120) NULL UNIQUE'
    },
    {
        nome: 'eventos.publico_esperado',
        sql: 'ALTER TABLE eventos ADD COLUMN publico_esperado INT UNSIGNED NULL'
    },
    {
        nome: 'eventos.capacidade_maxima',
        sql: 'ALTER TABLE eventos ADD COLUMN capacidade_maxima INT UNSIGNED NULL'
    },
    {
        nome: 'eventos.margem_percentual',
        sql: 'ALTER TABLE eventos ADD COLUMN margem_percentual DECIMAL(5, 2) NULL DEFAULT 15.00'
    },
    {
        nome: 'eventos.venda_publicada',
        sql: 'ALTER TABLE eventos ADD COLUMN venda_publicada TINYINT(1) NOT NULL DEFAULT 0'
    },
    {
        nome: 'eventos.taxa_mp_percentual',
        sql: 'ALTER TABLE eventos ADD COLUMN taxa_mp_percentual DECIMAL(5, 2) NULL DEFAULT 4.99'
    },
    {
        nome: 'eventos.repassa_taxa_comprador',
        sql: 'ALTER TABLE eventos ADD COLUMN repassa_taxa_comprador TINYINT(1) NOT NULL DEFAULT 0'
    },
    {
        nome: 'bandas.descricao',
        sql: 'ALTER TABLE bandas ADD COLUMN descricao TEXT NULL'
    }
];

const colunasPosTabelas = [
    {
        nome: 'pedidos_ingresso.cupom_id',
        sql: 'ALTER TABLE pedidos_ingresso ADD COLUMN cupom_id INT NULL'
    },
    {
        nome: 'pedidos_ingresso.desconto_aplicado',
        sql: 'ALTER TABLE pedidos_ingresso ADD COLUMN desconto_aplicado DECIMAL(10, 2) NULL DEFAULT 0'
    }
];

const tabelas = [
    {
        nome: 'custos_evento',
        sql: `CREATE TABLE IF NOT EXISTS custos_evento (
            id INT AUTO_INCREMENT PRIMARY KEY,
            evento_id INT NOT NULL,
            descricao VARCHAR(255) NOT NULL,
            categoria VARCHAR(80) NULL,
            valor DECIMAL(10, 2) NOT NULL DEFAULT 0,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
        )`
    },
    {
        nome: 'lotes_ingresso',
        sql: `CREATE TABLE IF NOT EXISTS lotes_ingresso (
            id INT AUTO_INCREMENT PRIMARY KEY,
            evento_id INT NOT NULL,
            nome VARCHAR(120) NOT NULL,
            preco DECIMAL(10, 2) NOT NULL,
            quantidade_total INT UNSIGNED NOT NULL,
            quantidade_vendida INT UNSIGNED NOT NULL DEFAULT 0,
            quantidade_reservada INT UNSIGNED NOT NULL DEFAULT 0,
            ordem INT NOT NULL DEFAULT 0,
            inicio_venda DATETIME NULL,
            fim_venda DATETIME NULL,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
        )`
    },
    {
        nome: 'pedidos_ingresso',
        sql: `CREATE TABLE IF NOT EXISTS pedidos_ingresso (
            id INT AUTO_INCREMENT PRIMARY KEY,
            evento_id INT NOT NULL,
            codigo_publico VARCHAR(32) NOT NULL UNIQUE,
            nome VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            status ENUM('pendente', 'pago', 'expirado', 'cancelado') NOT NULL DEFAULT 'pendente',
            canal ENUM('site', 'porta', 'cortesia') NOT NULL DEFAULT 'site',
            mp_payment_id VARCHAR(64) NULL,
            total DECIMAL(10, 2) NOT NULL DEFAULT 0,
            taxa_estimada DECIMAL(10, 2) NULL,
            expires_at DATETIME NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
        )`
    },
    {
        nome: 'itens_pedido',
        sql: `CREATE TABLE IF NOT EXISTS itens_pedido (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pedido_id INT NOT NULL,
            lote_id INT NOT NULL,
            quantidade INT UNSIGNED NOT NULL,
            preco_unitario DECIMAL(10, 2) NOT NULL,
            FOREIGN KEY (pedido_id) REFERENCES pedidos_ingresso(id) ON DELETE CASCADE,
            FOREIGN KEY (lote_id) REFERENCES lotes_ingresso(id) ON DELETE RESTRICT
        )`
    },
    {
        nome: 'ingressos_emitidos',
        sql: `CREATE TABLE IF NOT EXISTS ingressos_emitidos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            codigo VARCHAR(64) NOT NULL UNIQUE,
            pedido_id INT NOT NULL,
            lote_id INT NOT NULL,
            status ENUM('valido', 'usado', 'cancelado') NOT NULL DEFAULT 'valido',
            usado_em DATETIME NULL,
            usado_por INT NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pedido_id) REFERENCES pedidos_ingresso(id) ON DELETE CASCADE,
            FOREIGN KEY (lote_id) REFERENCES lotes_ingresso(id) ON DELETE RESTRICT,
            FOREIGN KEY (usado_por) REFERENCES usuarios(id) ON DELETE SET NULL
        )`
    },
    {
        nome: 'cupons',
        sql: `CREATE TABLE IF NOT EXISTS cupons (
            id INT AUTO_INCREMENT PRIMARY KEY,
            evento_id INT NOT NULL,
            codigo VARCHAR(40) NOT NULL,
            desconto_percentual DECIMAL(5, 2) NOT NULL,
            uso_max INT UNSIGNED NULL,
            uso_atual INT UNSIGNED NOT NULL DEFAULT 0,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_cupom_evento (evento_id, codigo),
            FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
        )`
    },
    {
        nome: 'lista_espera',
        sql: `CREATE TABLE IF NOT EXISTS lista_espera (
            id INT AUTO_INCREMENT PRIMARY KEY,
            evento_id INT NOT NULL,
            email VARCHAR(255) NOT NULL,
            avisado_em DATETIME NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_lista_evento_email (evento_id, email),
            FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
        )`
    }
];

async function slugUnico(conn, base, eventoId) {
    let sufixo = 0;
    while (sufixo < 500) {
        const candidato = sufixo ? `${base}-${sufixo}`.slice(0, 120) : base;
        const [rows] = await conn.query(
            'SELECT id FROM eventos WHERE slug = ? AND id != ?',
            [candidato, eventoId]
        );
        if (!rows.length) return candidato;
        sufixo += 1;
    }
    return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

async function executarPasso(conn, passo, log) {
    try {
        await conn.query(passo.sql);
        log(`Criado: ${passo.nome}`);
    } catch (err) {
        if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
            log(`Já existe: ${passo.nome}`);
        } else {
            throw err;
        }
    }
}

async function migrar({ log = () => {} } = {}) {
    const host = process.env.DB_HOST || '';
    const porta = Number(process.env.DB_PORT) || 3306;
    const usarSsl = usarSslMysql(host);

    const conn = await mysql.createConnection({
        host,
        port: porta,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: usarSsl ? { rejectUnauthorized: true } : undefined,
        multipleStatements: true
    });

    try {
        for (const passo of colunas) {
            await executarPasso(conn, passo, log);
        }

        for (const passo of tabelas) {
            await conn.query(passo.sql);
            log(`Tabela ok: ${passo.nome}`);
        }

        for (const passo of colunasPosTabelas) {
            await executarPasso(conn, passo, log);
        }

        const [semToken] = await conn.query(
            'SELECT id FROM lineup WHERE token_publico IS NULL'
        );
        for (const row of semToken) {
            await conn.query('UPDATE lineup SET token_publico = ? WHERE id = ?', [
                crypto.randomBytes(16).toString('hex'),
                row.id
            ]);
        }
        if (semToken.length) {
            log(`Tokens gerados para ${semToken.length} escalação(ões)`);
        }

        const [semSlug] = await conn.query(
            "SELECT id, nome FROM eventos WHERE slug IS NULL OR slug = ''"
        );
        for (const row of semSlug) {
            const base = gerarSlugBase(row.nome);
            const slug = await slugUnico(conn, base, row.id);
            await conn.query('UPDATE eventos SET slug = ? WHERE id = ?', [slug, row.id]);
        }
        if (semSlug.length) {
            log(`Slugs gerados para ${semSlug.length} evento(s)`);
        }
    } finally {
        await conn.end();
    }
}

module.exports = { migrar };
