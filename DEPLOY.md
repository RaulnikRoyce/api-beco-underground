# Deploy — API Beco Underground

## Render (API)

1. Conecte o repositório `api-beco-underground`.
2. Build: `npm install`. Start: `node server.js` (ou `npm start`).
3. Em **Environment**, cadastre:

| Variável | Por quê |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Sem isto o processo **não sobe** (erro no log: `JWT_SECRET`) |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` | Railway |
| `CORS_ORIGIN` | URL do frontend no ar |

Para gerar o segredo no seu PC (não cole no GitHub):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Cole o resultado só no painel do Render → **Save Changes** → **Manual Deploy**.

Em produção o CORS **não** libera `localhost`. Só origens em `CORS_ORIGIN`.

## Railway (MySQL)

No Render use o host **público** do Railway (`*.proxy.rlwy.net` ou similar) e a **porta pública** (quase nunca é 3306).  
`mysql.railway.internal` só funciona entre serviços **dentro** do Railway — o Render não alcança essa rede. Por isso o log `Connection lost: The server closed the connection`.

No Render, o mais seguro é uma variável só:

- `DATABASE_URL` = copie **MYSQL_PUBLIC_URL** do Railway (a que tem `proxy.rlwy.net` e porta alta)

Não use `MYSQL_URL` / `mysql.railway.internal` / porta 3306 no Render.

Se preferir campos separados: `DB_HOST=….proxy.rlwy.net`, `DB_PORT=` porta pública, `DB_USER`, `DB_PASSWORD`, `DB_NAME=railway`.

MySQL 8 no Railway, de fora, usa TCP **sem** TLS (`mysql://`, não `mysqls://`). O código **não** liga SSL, a menos que você defina `DB_SSL=true`.

Importe `database/schema.sql`. Se o banco já existia sem `criado_por`, rode `database/migrations/001_eventos_criado_por.sql`.

## Checagem

- `GET https://api-beco-underground.onrender.com/health` → `{ "status": "ok" }`
- `GET /openapi.json` → contrato das rotas
