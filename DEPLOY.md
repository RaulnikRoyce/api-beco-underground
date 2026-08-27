# Deploy — API Beco Underground

## Render (API)

1. Conecte o repositório `api-beco-underground`.
2. Build: `npm install`. Start: `node server.js` (ou `npm start`).
3. Em **Environment**, cadastre:

| Variável | Por quê |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Sem isto o processo **não sobe** (erro no log: `JWT_SECRET`) |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` | MySQL na Aiven (host público + porta pública) |
| `DB_SSL` | `true` na Aiven (também liga sozinho se o host for `*.aivencloud.com`) |
| `CORS_ORIGIN` | `https://gestaobeco.netlify.app` (origem exata do painel) |

Para gerar o segredo no seu PC (não cole no GitHub):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Cole o resultado só no painel do Render → **Save Changes** → **Manual Deploy**.

Em produção o CORS **não** libera `localhost`. Só origens em `CORS_ORIGIN`.

## Aiven (MySQL)

A API no Render alcança só o host **público** da Aiven (`*.aivencloud.com`) e a **porta pública** (não é 3306). MySQL na Aiven exige TLS: `DB_SSL=true` ou host Aiven.

Importe `database/schema-cloud.sql` (ou rode `npm run import:schema` com as variáveis da Aiven na sessão). Se o banco já existia sem `ativo` / `token_publico`, rode `npm run migrate`.

Não commite senha. Não cole `DB_PASSWORD` no chat.

## Checagem

- Painel: `https://gestaobeco.netlify.app/`
- `GET https://api-beco-underground.onrender.com/health` → `{ "status": "ok" }` (503 se o MySQL não responder)
- `GET /openapi.json` → contrato das rotas
