# Deploy — API Beco Underground

## Render (API)

1. Conecte o repositório `api-beco-underground`.
2. Build: `npm install`. Start: `node server.js`.
3. Variáveis obrigatórias:
   - `NODE_ENV=production`
   - `JWT_SECRET` — chave longa, sem fallback
   - `CORS_ORIGIN` — URL do frontend (vírgula se houver mais de uma)
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` (Railway)
4. Sem `JWT_SECRET` o processo não sobe.

Em produção o CORS **não** libera `localhost` automaticamente. Só origens listadas em `CORS_ORIGIN`.

## Railway (MySQL)

Importe `database/schema.sql`. Se o banco já existia sem `criado_por`, rode `database/migrations/001_eventos_criado_por.sql`.

## Checagem

- `GET https://api-beco-underground.onrender.com/health` → `{ "status": "ok" }`
- `GET /openapi.json` → contrato das rotas
