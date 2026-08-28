# Deploy da API Beco Underground

## Render (API)

1. Conecte o repositório `api-beco-underground`.
2. Build `npm install`. Start `node server.js` (ou `npm start`).
3. Em **Environment**, cadastre as variáveis abaixo.

| Variável | Por quê |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Obrigatório. O boot exige esta variável e registra `JWT_SECRET` no log quando ela falta |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` | MySQL na Aiven (host público e porta pública) |
| `DB_SSL` | `true` na Aiven (também liga sozinho se o host for `*.aivencloud.com`) |
| `CORS_ORIGIN` | `https://gestaobeco.netlify.app` (origem exata do painel) |

Gere o segredo no seu PC e evite colar no GitHub.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Cole o resultado só no painel do Render, **Save Changes**, depois **Manual Deploy**.

Em produção o CORS aceita só as origens listadas em `CORS_ORIGIN`.

## Aiven (MySQL)

A API no Render alcança o host público da Aiven (`*.aivencloud.com`) e a porta pública (em geral uma porta alta, distinta de 3306). MySQL na Aiven exige TLS. Use `DB_SSL=true` ou um host Aiven.

Importe `database/schema-cloud.sql` (ou rode `npm run import:schema` com as variáveis da Aiven na sessão). Se o banco já existia sem `ativo` / `token_publico`, rode `npm run migrate`.

Evite commitar senha. Evite colar `DB_PASSWORD` no chat.

## Checagem

- Painel `https://gestaobeco.netlify.app/`
- `GET https://api-beco-underground.onrender.com/health` responde `{ "status": "ok" }` (503 se o MySQL não responder)
- `GET /openapi.json` contrato das rotas
