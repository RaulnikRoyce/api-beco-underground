-- Beco Underground — schema MySQL 8+
-- Uso: mysql -u beco -p beco_underground < database/schema.sql

CREATE DATABASE IF NOT EXISTS beco_underground
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE beco_underground;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  senha VARCHAR(255) NOT NULL,
  perfil ENUM('admin', 'usuario') NOT NULL DEFAULT 'usuario',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_usuarios_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS eventos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  data DATE NOT NULL,
  local VARCHAR(200) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_eventos_data (data)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bandas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  genero VARCHAR(100) NULL,
  contato VARCHAR(254) NULL,
  cache_base DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_bandas_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lineup (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  evento_id INT UNSIGNED NOT NULL,
  banda_id INT UNSIGNED NOT NULL,
  horario TIME NOT NULL,
  cache_negociado DECIMAL(10, 2) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lineup_evento
    FOREIGN KEY (evento_id) REFERENCES eventos (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_lineup_banda
    FOREIGN KEY (banda_id) REFERENCES bandas (id)
    ON DELETE RESTRICT,
  UNIQUE KEY uk_lineup_evento_banda (evento_id, banda_id),
  KEY idx_lineup_horario (evento_id, horario)
) ENGINE=InnoDB;
