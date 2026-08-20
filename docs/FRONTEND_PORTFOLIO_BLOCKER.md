# Frontend — mudanças portfolio-ready (bloqueio de push)

## Status

As alterações do frontend foram implementadas em `/tmp/frontend-beco-underground` na branch
`cursor/portfolio-ready-frontend-e775`, mas o token do agente **não tem permissão de push**
em `RaulnikRoyce/frontend-beco-underground` (`Permission denied to cursor[bot]`, HTTP 403).

## Patch

Aplique no clone do frontend:

```bash
git checkout -b cursor/portfolio-ready-frontend-e775
git apply docs/frontend-portfolio-ready.patch   # se copiar este arquivo do repo da API
# ou, a partir deste repositório:
git apply /caminho/para/api-beco-underground/docs/frontend-portfolio-ready.patch
git commit -am "feat(frontend): login JWT, API URL e alinhamento com a API"
git push -u origin cursor/portfolio-ready-frontend-e775
```

## O que mudou

| Item | Detalhe |
|------|---------|
| Login | Tela de login; token em `localStorage` (`token_beco`); perfil em `perfil_beco` |
| API URL | `import.meta.env.VITE_API_URL` em `src/api.js` + `.env.example` |
| Line-up | Horário obrigatório no UI; campos `nome` / `lineup_id` / `cache` |
| Bandas | `cache_base` enviado como `Number(...)` |
| Limpeza | Removido `HelloWorld.vue`; README e título da página atualizados |

## Dependência da API

Requer a branch `cursor/portfolio-ready-api-e775` (POST/DELETE eventos, DELETE bandas, login com `perfil`).
