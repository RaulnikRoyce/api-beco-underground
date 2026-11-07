CREATE TABLE IF NOT EXISTS cancelamentos_ingresso (
    pedido_id INT NOT NULL PRIMARY KEY,
    payment_id VARCHAR(64) NOT NULL,
    chave VARCHAR(64) NOT NULL UNIQUE,
    status ENUM('pendente', 'concluido') NOT NULL DEFAULT 'pendente',
    lease_token VARCHAR(64) NULL,
    lease_ate DATETIME NULL,
    tentativas INT UNSIGNED NOT NULL DEFAULT 0,
    ultimo_erro VARCHAR(500) NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos_ingresso(id) ON DELETE CASCADE
);
