# API Beco Underground

<img src="public/logo-beco.png" alt="Logo Beco Underground Produções" width="160">

API REST para gestão de eventos independentes (lineup, artistas, cachê e ingressos).

**Demo** [https://demo.raulnikroyce.dev/](https://demo.raulnikroyce.dev/) · **Loja** [https://ingressosbeco.raulnikroyce.dev](https://ingressosbeco.raulnikroyce.dev)  
**Painel** [frontend-beco-underground](https://github.com/RaulnikRoyce/frontend-beco-underground) · **Ingressos** [frontend-beco-ingressos](https://github.com/RaulnikRoyce/frontend-beco-ingressos) · **API** este repositório

Produção usa os frontends Vue no Vercel, esta API no [Render](https://api-beco-underground.onrender.com) e MySQL na Aiven.

## Sobre este projeto

Repositório de um projeto pessoal de estudo. Treino engenharia de software no problema real da produção de eventos, organizar lineup, artistas, horários, cachê e venda de ingressos no painel que uso no trabalho.

Eu defini a arquitetura, as regras e o primeiro código. No fechamento usei o [Cursor](https://cursor.com) como auxílio em deploy e polimento.

## Por que esta arquitetura

O painel precisa de regras sobre quem entra, quem cria evento, quem escala artista e quem vê o custo. A loja consome rotas públicas e de pedido sem login. O fluxo é sempre `Rota → Controller → Service → Repository → MySQL`. A rota autentica e valida, o service decide permissão e o repositório executa SQL.

## Stack

Node.js · Express (CommonJS) · MySQL · JWT · Zod · Mercado Pago (Checkout Pro)

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

Para checkout real na loja local, configure `MP_ACCESS_TOKEN` no `.env` (token Mercado Pago). Sem o token, a loja ainda lista eventos e simula o fluxo até o pagamento.

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
| GET/POST/PATCH/DELETE | `/eventos/:id/custos`, `/lotes`, `/ingressos/*` | logado; escrita admin |
| GET/POST/DELETE | `/bandas` | leitura logada; escrita admin |
| GET/POST/PATCH/DELETE | `/lineup` | leitura logada; escrita admin |
| GET | `/publico/:token` | público; página da banda (só o cachê dela) |
| GET | `/publico/eventos` | público; próximos shows na loja |
| GET | `/publico/eventos/:slugOuId` | público; evento e lotes abertos |
| POST | `/ingressos/pedidos` | público (rate limit; checkout MP) |
| GET | `/ingressos/pedidos/:codigo` | público; status do pedido |
| GET | `/ingressos/emitidos/:codigo` | público; QR do ingresso pago |
| POST | `/ingressos/recuperar` | público; busca por e-mail + código |
| POST | `/ingressos/lista-espera` | público |
| POST | `/ingressos/webhook` | Mercado Pago |
| POST | `/ingressos/checkin/:codigo` | admin |
| GET | `/ingressos/dashboard/financeiro` | admin |
| GET | `/dashboard/:evento_id` | admin |

Listas de eventos aceitam `q`, `ordenar=data_desc|data_asc|nome` e, se `page` for enviado, devolvem `{ dados, meta }`.

## Produção

Ver [DEPLOY.md](./DEPLOY.md). Variáveis de banco, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`, `NODE_ENV=production`. Para ingressos, inclua `MP_ACCESS_TOKEN`, `LOJA_INGRESSOS_URL` e `API_PUBLIC_URL`. Host `*.aivencloud.com` liga SSL sozinho.
