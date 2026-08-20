# Frontend — publicar no GitHub (sua conta)

O agente Cloud **não consegue dar push** em `frontend-beco-underground` (403 para `cursor[bot]`).
A API já está no PR: https://github.com/RaulnikRoyce/api-beco-underground/pull/2

## Opção A — no seu PC (recomendado)

Abra o **terminal do seu computador** (não o Cloud Agent), logado no GitHub:

```bash
git clone https://github.com/RaulnikRoyce/frontend-beco-underground.git
cd frontend-beco-underground
git checkout -b cursor/portfolio-ready-frontend-e775

# Baixe o patch do PR da API (raw):
curl -L -o frontend.patch \
  https://raw.githubusercontent.com/RaulnikRoyce/api-beco-underground/cursor/portfolio-ready-api-e775/docs/frontend-portfolio-ready.patch

git apply frontend.patch
git add -A
git commit -m "feat(frontend): login JWT, VITE_API_URL e line-up com horário"
git push -u origin cursor/portfolio-ready-frontend-e775
```

Depois no GitHub: abra o PR da branch para `main` do frontend.

## Opção B — GitHub web

1. Abra o patch:  
   https://github.com/RaulnikRoyce/api-beco-underground/blob/cursor/portfolio-ready-api-e775/docs/frontend-portfolio-ready.patch  
2. Aplique localmente (Opção A) — o GitHub web não aplica `.patch` grande com facilidade.

## O que o patch inclui

| Item | Detalhe |
|------|---------|
| Login | JWT; `token_beco` + `perfil_beco`; logout e redirect em 401 |
| API URL | `VITE_API_URL` + `.env.example` |
| Line-up | Horário obrigatório HH:MM |
| Limpeza | Remove HelloWorld; README do produto |

## Depois de publicar o frontend

1. Merge do [PR #2 da API](https://github.com/RaulnikRoyce/api-beco-underground/pull/2)  
2. Merge do PR do frontend  
3. (Opcional) prints em `docs/screenshots/` da API  

Login local de teste: `admin@beco.local` / `Admin123!`
