# Frontend — mudanças portfolio-ready (bloqueio de push)

## Status

As alterações do frontend foram implementadas em `/tmp/frontend-beco-underground` na branch
`cursor/portfolio-ready-frontend-e775`, mas o token do agente **não tem permissão de push**
em `RaulnikRoyce/frontend-beco-underground` (`Permission denied to cursor[bot]`, HTTP 403).

## Patch

Aplique no clone do frontend:

```bash
cd frontend-beco-underground
git checkout -b cursor/portfolio-ready-frontend-e775
git apply /caminho/para/api-beco-underground/docs/frontend-portfolio-ready.patch
git add -A
git commit -m "feat(frontend): login JWT, VITE_API_URL e line-up com horário"
git push -u origin cursor/portfolio-ready-frontend-e775
```

## O que mudou

| Item | Detalhe |
|------|---------|
| Login | Tela de login JWT; `token_beco` + `perfil_beco` no `localStorage`; logout e 401 |
| API URL | `import.meta.env.VITE_API_URL` em `src/api.js` + `.env.example` |
| Line-up | Horário obrigatório (HH:MM); campos `nome` / `lineup_id` / `cache` |
| Limpeza | Removido `HelloWorld.vue`; README e título da página atualizados |

## Dependência da API

Requer a branch `cursor/portfolio-ready-api-e775` (POST/DELETE eventos, DELETE bandas, login com `perfil`).
