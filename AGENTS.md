# AGENTS.md

API REST do sistema **Beco Underground** (Node.js + Express 5 + MySQL). Gerencia bandas, eventos, escalação (lineup) e um dashboard agregado, com autenticação JWT e controle de perfil (`usuario` / `admin`).

Ponto de entrada: `server.js` → `src/app.js`. Estrutura em camadas: `routes` → `controllers` → `services`/`repositories` → `database/db.js` (pool `mysql2`).

## Comandos principais

- Instalar dependências: `npm ci`
- Rodar testes: `npm test` (Node test runner nativo; **não** precisa de banco)
- Subir a API (dev): `npm start` (porta `PORT`, padrão `3000`)
- Não há linter/formatter configurado neste projeto (sem `eslint`/`prettier`, sem script `lint`).
- CI (`.github/workflows/ci.yml`): Node 20 rodando `npm ci` + `npm test`. Localmente Node 22 também funciona.

## Cursor Cloud specific instructions

Estas notas cobrem apenas o que NÃO é óbvio. `npm ci` já roda automaticamente no update script.

### Banco de dados MySQL (obrigatório para rodar a API, não para `npm test`)

- MySQL 8.0 é uma dependência de sistema (instalada via `apt`, fora do repositório). O `systemd` não roda neste container, então inicie o servidor manualmente numa sessão tmux:
  - `sudo mysqld --user=mysql` (verifique com `sudo mysqladmin ping`).
- **Não existe arquivo de schema/migração/seed no repositório.** A estrutura original do banco vive apenas na máquina do dono do projeto e nunca foi commitada. As tabelas (`usuarios`, `bandas`, `eventos`, `lineup`) precisam ser criadas manualmente. Schema reconstruído a partir das queries do código:

```sql
CREATE DATABASE IF NOT EXISTS beco_underground CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'beco'@'localhost' IDENTIFIED WITH mysql_native_password BY 'beco_dev_password';
GRANT ALL PRIVILEGES ON beco_underground.* TO 'beco'@'localhost';
FLUSH PRIVILEGES;
USE beco_underground;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    perfil VARCHAR(20) NOT NULL DEFAULT 'usuario',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bandas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    genero VARCHAR(100),
    contato VARCHAR(254),
    cache_base DECIMAL(10,2) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS eventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    data DATE NOT NULL,
    local VARCHAR(200) NOT NULL
);
CREATE TABLE IF NOT EXISTS lineup (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evento_id INT NOT NULL,
    banda_id INT NOT NULL,
    horario VARCHAR(5) NOT NULL,
    cache_negociado DECIMAL(10,2) NULL,
    CONSTRAINT fk_lineup_evento FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
    CONSTRAINT fk_lineup_banda FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE
);
```

> Se o schema original for commitado como `.sql` no futuro, use-o no lugar deste bloco reconstruído.

### Variáveis de ambiente

- Copie `.env.example` para `.env`. `src/database/db.js` **lança erro no startup** se faltar `DB_HOST`, `DB_USER` ou `DB_NAME`.
- Para o `.env` bater com o schema acima, use `DB_HOST=127.0.0.1`, `DB_USER=beco`, `DB_PASSWORD=beco_dev_password`, `DB_NAME=beco_underground`, e defina um `JWT_SECRET` qualquer.

### Detalhes não óbvios do fluxo

- `POST /auth/registrar` cria usuário sempre com `perfil='usuario'`. Para testar rotas de admin (`POST /bandas`, `POST /lineup`, `GET /dashboard/:id`) promova via SQL: `UPDATE usuarios SET perfil='admin' WHERE email=...`.
- Não há rota para criar **eventos** — insira eventos direto no banco via SQL para testar lineup/dashboard.
- Os arquivos HTML em `src/` (`index.html`, `login.html`, `eventos.html`) não são servidos pelo Express; o produto é a API. Teste via `curl`/Postman.
- `GET /health` retorna `{"status":"ok","database":"ok"}` quando o banco está acessível — bom smoke test após subir tudo.
