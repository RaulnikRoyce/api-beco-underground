# API Beco Underground

<img src="public/logo-beco.png" alt="Logo Beco Underground Produções" width="160">

API REST para gestão de eventos independentes (lineup, artistas e cachê).

**Demo** [https://gestaobeco.netlify.app/](https://gestaobeco.netlify.app/)  
**Painel** [frontend-beco-underground](https://github.com/RaulnikRoyce/frontend-beco-underground) · **API** este repositório

Produção usa Vue no Netlify, esta API no [Render](https://api-beco-underground.onrender.com) e MySQL na Aiven.

## Sobre este projeto

Repositório de um projeto pessoal de estudo. Treino engenharia de software no problema real da produção de eventos, organizar lineup, artistas, horários e cachê no painel que uso no trabalho.

Eu defini a arquitetura, as regras e o primeiro código. No fechamento usei o [Cursor](https://cursor.com) como auxílio em deploy e polimento.

## Por que esta arquitetura

O painel precisa de regras sobre quem entra, quem cria evento, quem escala artista e quem vê o custo. O fluxo é sempre `Rota → Controller → Service → Repository → MySQL`. A rota autentica e valida, o service decide permissão e o repositório executa SQL.

## Stack

Node.js · Express (CommonJS) · MySQL · JWT · Zod

## Subir local

1. MySQL (XAMPP) e importe `database/schema.sql`
2. Copie `.env.example` para `.env` e preencha o banco + `JWT_SECRET` (obrigatório)
3. Para apontar ao MySQL local, crie `.env.local` a partir de `.env.local.example`
4. Instale as dependências e suba o servidor.

```bash
npm install
npm run seed:admin
npm run dev
```

API em `http://localhost:3000`. Saúde em `GET /health` (processo + `SELECT 1` no MySQL). Contrato em `GET /openapi.json`.

Seed local usa `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` no `.env` (veja `.env.example`). Depois do primeiro login, troque a própria senha em `PATCH /auth/senha`. Em produção use o cadastro público de produtor e evite a senha do seed. Quem esqueceu a senha pede ao admin (`PATCH /auth/usuarios/:id/senha`). O admin troca a própria no perfil.

## Testes

```bash
npm test
npm run lint
```

## Rotas

| Método | Caminho | Quem |
|---|---|---|
| POST | `/auth/login` | público (rate limit) |
| POST | `/auth/registrar` | público; sempre cria `produtor` |
| PATCH | `/auth/senha` | logado (troca a própria senha; exige a atual) |
| GET/PATCH/DELETE | `/auth/usuarios` | admin (bloquear e excluir equipe) |
| PATCH | `/auth/usuarios/:id/senha` | admin (redefinir senha de outro usuário) |
| GET/POST/PATCH/DELETE | `/eventos` | logado; editar e excluir, dono ou admin |
| GET `/eventos?include=lineup` | eventos + lineup em uma ida | logado |
| GET/POST/DELETE | `/bandas` | leitura logada; escrita admin |
| GET/POST/PATCH/DELETE | `/lineup` | leitura logada; escrita admin |
| GET | `/publico/:token` | público; página da banda (só o cachê dela) |
| GET | `/dashboard/:evento_id` | admin |

Listas de eventos aceitam `q`, `ordenar=data_desc|data_asc|nome` e, se `page` for enviado, devolvem `{ dados, meta }`.

## Produção

Ver [DEPLOY.md](./DEPLOY.md). Variáveis `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `DB_SSL`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`, `NODE_ENV=production`. Host `*.aivencloud.com` liga SSL sozinho.
