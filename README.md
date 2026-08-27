# API Beco Underground

API REST para gestão de eventos independentes (lineup, artistas e cachê).

**Demo:** [https://gestaobeco.netlify.app/](https://gestaobeco.netlify.app/)  
**Painel:** [frontend-beco-underground](https://github.com/RaulnikRoyce/frontend-beco-underground) · **API:** este repositório

Produção: Vue no Netlify, esta API no [Render](https://api-beco-underground.onrender.com), MySQL na Aiven.

## Sobre este projeto

Este repositório faz parte de um **projeto pessoal de estudo**. O objetivo é treinar engenharia de software em um problema real da minha atuação como **promotor de eventos**: organizar lineup, artistas, horários e cachê — o tipo de painel que uso na produção.

O Beco Underground nasceu **solo**: arquitetura, regras de negócio e o primeiro código foram definidos e escritos por mim. **Perto do final**, usei o [Cursor](https://cursor.com) só como **auxílio estratégico** (decisões de fechamento, deploy e polimento) para concluir o projeto — não como autor da ideia nem do desenho inicial.

## Por quê esta arquitetura

O painel precisa de regras claras: quem entra, quem cria evento, quem escala artista e quem vê o custo. Por isso o fluxo é sempre `Rota → Controller → Service → Repository → MySQL`. A rota não fala com o banco; o repositório não decide permissão.

## Stack

Node.js · Express (CommonJS) · MySQL · JWT · Zod

## Subir local

1. MySQL (XAMPP) e importe `database/schema.sql`
2. Copie `.env.example` para `.env` e preencha o banco + `JWT_SECRET` (obrigatório)
3. Para apontar ao MySQL local (e não à Aiven), crie `.env.local` a partir de `.env.local.example`
4. Instale e suba:

```bash
npm install
npm run seed:admin
npm run dev
```

API em `http://localhost:3000`. Saúde: `GET /health` (processo + `SELECT 1` no MySQL). Contrato: `GET /openapi.json`.

Seed local: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` no `.env` (veja `.env.example`). Depois do primeiro login, troque a própria senha em `PATCH /auth/senha`. Em produção use o cadastro público de produtor — não reutilize a senha do seed. Sem e-mail de recuperação: quem esqueceu pede ao admin (`PATCH /auth/usuarios/:id/senha`); o admin troca a própria no perfil.

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
| GET/PATCH/DELETE | `/auth/usuarios` | admin (bloquear/excluir equipe) |
| PATCH | `/auth/usuarios/:id/senha` | admin (redefinir senha de outro usuário) |
| GET/POST/PATCH/DELETE | `/eventos` | logado; editar/excluir: dono ou admin |
| GET `/eventos?include=lineup` | eventos + lineup em uma ida | logado |
| GET/POST/DELETE | `/bandas` | leitura logada; escrita admin |
| GET/POST/PATCH/DELETE | `/lineup` | leitura logada; escrita admin |
| GET | `/publico/:token` | público; página da banda (só o cachê dela) |
| GET | `/dashboard/:evento_id` | admin |

Listas de eventos aceitam `q`, `ordenar=data_desc|data_asc|nome` e, se `page` for enviado, devolvem `{ dados, meta }`.

## Produção

Ver [DEPLOY.md](./DEPLOY.md). Variáveis: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `DB_SSL`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`, `NODE_ENV=production`. Host `*.aivencloud.com` liga SSL sozinho.
