CREATE DATABASE IF NOT EXISTS beco_underground CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE beco_underground;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    perfil ENUM('admin', 'produtor') NOT NULL DEFAULT 'produtor',
    ativo TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS eventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    data DATE NOT NULL,
    local VARCHAR(255) NOT NULL,
    criado_por INT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_eventos_criado_por ON eventos(criado_por);

CREATE TABLE IF NOT EXISTS bandas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    genero VARCHAR(100),
    contato VARCHAR(120),
    cache_base DECIMAL(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lineup (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evento_id INT NOT NULL,
    banda_id INT NOT NULL,
    horario TIME NULL,
    cache_negociado DECIMAL(10, 2) NULL,
    token_publico VARCHAR(64) NULL UNIQUE,
    UNIQUE KEY unique_escalacao (evento_id, banda_id),
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
    FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE RESTRICT
);

CREATE INDEX idx_lineup_evento ON lineup(evento_id);
CREATE INDEX idx_lineup_banda ON lineup(banda_id);
