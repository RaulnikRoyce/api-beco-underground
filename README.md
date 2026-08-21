# API Beco Underground

API REST para gestão de eventos independentes (lineup, artistas e cachê).

## Por quê esta arquitetura

O painel precisa de regras claras: quem entra, quem cria evento, quem escala artista e quem vê o custo. Por isso o fluxo é sempre `Rota → Controller → Service → Repository → MySQL`. A rota não fala com o banco; o repositório não decide permissão.

## Stack

Node.js · Express (CommonJS) · MySQL · JWT · Zod

## Subir local

1. MySQL (XAMPP) e importe `database/schema.sql`
2. Copie `.env.example` para `.env` e preencha o banco + `JWT_SECRET` (obrigatório)
3. Para não usar o Railway em desenvolvimento, crie `.env.local` a partir de `.env.local.example`
4. Instale e suba:

```bash
npm install
npm run seed:admin
npm run dev
```

API em `http://localhost:3000`. Saúde: `GET /health`. Contrato: `GET /openapi.json`.

Admin padrão do seed: `admin@beco.com` / `admin123` (troque depois).

## Testes

```bash
npm test
npm run lint
```

## Rotas

| Método | Caminho | Quem |
|---|---|---|
| POST | `/auth/login` | público (rate limit) |
| POST | `/auth/registrar` | admin |
| GET/POST/DELETE | `/eventos` | logado; exclusão: dono ou admin |
| GET `/eventos?include=lineup` | eventos + lineup em uma ida | logado |
| GET/POST/DELETE | `/bandas` | leitura logada; escrita admin |
| GET/POST | `/lineup` | leitura logada; POST admin |
| GET | `/dashboard/:evento_id` | admin |

Listas de eventos aceitam `q`, `ordenar=data_desc|data_asc|nome` e, se `page` for enviado, devolvem `{ dados, meta }`.

## Produção

Ver [DEPLOY.md](./DEPLOY.md). Variáveis: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`, `NODE_ENV=production`.
