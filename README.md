# API Beco Underground

API REST para gestão de **eventos underground**, **bandas** e **line-up de palco** (horários e cachês).

Frontend (Vue 3): [frontend-beco-underground](https://github.com/RaulnikRoyce/frontend-beco-underground)

> Patch portfolio-ready do frontend (login + `VITE_API_URL`): ver `docs/FRONTEND_PORTFOLIO_BLOCKER.md` e `docs/frontend-portfolio-ready.patch` — o push no repo Vue pode exigir token com permissão de escrita.

## Problema que resolve

Casas e produtores precisam escalar artistas por evento, controlar horários de palco e somar cachês sem planilha solta. Esta API centraliza autenticação (JWT + perfis), CRUD de eventos/bandas e escalação no line-up, com validação Zod e painel resumido de custo por evento.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js 20+ |
| HTTP | Express 5 |
| Banco | MySQL 8 (mysql2 pool) |
| Auth | JWT + bcrypt |
| Validação | Zod |
| Segurança | Helmet, CORS, rate limit |
| Testes | Node.js built-in test runner (`node --test`) |
| Infra local | Docker Compose (MySQL) |

## Arquitetura

```
src/
  app.js                 # Express app (middlewares + rotas)
  database/db.js         # Pool MySQL
  routes/                # Rotas HTTP
  controllers/           # Orquestração request/response
  services/              # Regras de negócio
  repositories/          # Acesso ao banco (async/await)
  schemas/               # Schemas Zod
  middlewares/           # Auth JWT + validador
database/schema.sql      # DDL
scripts/seed-admin.js    # Admin de desenvolvimento
tests/                   # Testes unitários
```

Camadas: **rota → middleware (auth/validação) → controller → service → repository → MySQL**.

## Como rodar

### 1. Banco com Docker

```bash
docker compose up -d
```

Sobe MySQL 8 na porta `3306` e aplica `database/schema.sql` na primeira inicialização.

Credenciais padrão do Compose (espelhadas em `.env.example`):

- DB: `beco_underground`
- User: `beco` / Password: `beco123`

### 2. API

```bash
cp .env.example .env
npm ci
npm start
```

Health check: `GET http://localhost:3000/health`

### 3. Usuário admin (dev)

```bash
npm run seed
```

Login padrão: `admin@beco.local` / `Admin123!` (sobrescreva com `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

### 4. Frontend

Clone e rode o [frontend Vue](https://github.com/RaulnikRoyce/frontend-beco-underground) com `VITE_API_URL=http://localhost:3000`.

## Endpoints

Autenticação: header `Authorization: Bearer <token>` (exceto `/auth/*` e `/health`).

| Método | Rota | Auth | Perfil | Descrição |
|--------|------|------|--------|-----------|
| POST | `/auth/login` | — | — | Login → `{ token, perfil }` |
| POST | `/auth/registrar` | — | — | Cadastro (perfil `usuario`) |
| GET | `/eventos` | JWT | qualquer | Listar eventos |
| GET | `/eventos/:id` | JWT | qualquer | Detalhe do evento |
| POST | `/eventos` | JWT | admin | Criar evento |
| PUT | `/eventos/:id` | JWT | admin | Atualizar evento |
| DELETE | `/eventos/:id` | JWT | admin | Remover evento |
| GET | `/bandas` | JWT | qualquer | Listar bandas |
| GET | `/bandas/:id` | JWT | qualquer | Detalhe da banda |
| POST | `/bandas` | JWT | admin | Cadastrar banda |
| DELETE | `/bandas/:id` | JWT | admin | Remover banda |
| GET | `/lineup/:evento_id` | JWT | qualquer | Line-up (`lineup_id`, `nome`, `horario`, `cache`) |
| POST | `/lineup` | JWT | admin | Escalar banda (`evento_id`, `banda_id`, `horario`) |
| GET | `/dashboard/:evento_id` | JWT | admin | Resumo de custo do evento |
| GET | `/health` | — | — | Status API + banco |

## Scripts

```bash
npm start   # sobe a API
npm test    # testes unitários
npm run seed
```

## Screenshots

> Adicione prints do painel Vue (login, eventos + line-up, bandas) em `docs/screenshots/` e referencie aqui.

| Tela | Arquivo |
|------|---------|
| Login | `docs/screenshots/login.png` |
| Eventos / line-up | `docs/screenshots/eventos.png` |
| Bandas | `docs/screenshots/bandas.png` |

## Licença

Projeto de portfólio — uso educacional.
