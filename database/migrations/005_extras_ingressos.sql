CREATE TABLE IF NOT EXISTS cupons (
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
);

CREATE INDEX idx_cupons_evento ON cupons(evento_id);

CREATE TABLE IF NOT EXISTS lista_espera (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evento_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    avisado_em DATETIME NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_lista_evento_email (evento_id, email),
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
);

CREATE INDEX idx_lista_espera_evento ON lista_espera(evento_id);

ALTER TABLE pedidos_ingresso ADD COLUMN cupom_id INT NULL;
ALTER TABLE pedidos_ingresso ADD COLUMN desconto_aplicado DECIMAL(10, 2) NULL DEFAULT 0;
