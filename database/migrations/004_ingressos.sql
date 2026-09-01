-- Ingressos: colunas em eventos + tabelas de custos, lotes e esqueleto de pedidos

ALTER TABLE eventos ADD COLUMN slug VARCHAR(120) NULL UNIQUE;
ALTER TABLE eventos ADD COLUMN publico_esperado INT UNSIGNED NULL;
ALTER TABLE eventos ADD COLUMN capacidade_maxima INT UNSIGNED NULL;
ALTER TABLE eventos ADD COLUMN margem_percentual DECIMAL(5, 2) NULL DEFAULT 15.00;
ALTER TABLE eventos ADD COLUMN venda_publicada TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE eventos ADD COLUMN taxa_mp_percentual DECIMAL(5, 2) NULL DEFAULT 4.99;
ALTER TABLE eventos ADD COLUMN repassa_taxa_comprador TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS custos_evento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evento_id INT NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    categoria VARCHAR(80) NULL,
    valor DECIMAL(10, 2) NOT NULL DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
);

CREATE INDEX idx_custos_evento ON custos_evento(evento_id);

CREATE TABLE IF NOT EXISTS lotes_ingresso (
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
);

CREATE INDEX idx_lotes_evento ON lotes_ingresso(evento_id);

CREATE TABLE IF NOT EXISTS pedidos_ingresso (
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
);

CREATE INDEX idx_pedidos_evento ON pedidos_ingresso(evento_id);
CREATE INDEX idx_pedidos_status ON pedidos_ingresso(status);

CREATE TABLE IF NOT EXISTS itens_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    lote_id INT NOT NULL,
    quantidade INT UNSIGNED NOT NULL,
    preco_unitario DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos_ingresso(id) ON DELETE CASCADE,
    FOREIGN KEY (lote_id) REFERENCES lotes_ingresso(id) ON DELETE RESTRICT
);

CREATE INDEX idx_itens_pedido ON itens_pedido(pedido_id);

CREATE TABLE IF NOT EXISTS ingressos_emitidos (
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
);

CREATE INDEX idx_ingressos_pedido ON ingressos_emitidos(pedido_id);
CREATE INDEX idx_ingressos_codigo ON ingressos_emitidos(codigo);
