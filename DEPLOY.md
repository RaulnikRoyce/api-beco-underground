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
| `DB_SSL` | Obrigatório em produção: `true` (Aiven) ou `false`, explícito — o boot recusa subir sem essa variável definida, mesmo que o host seja reconhecido automaticamente |
| `CORS_ORIGIN` | `https://demo.raulnikroyce.dev,https://ingressosbeco.raulnikroyce.dev` — some também o domínio de qualquer site que embede o `widget.js` da loja (ex.: o site pessoal), senão o navegador bloqueia o `fetch` do widget nesse domínio |
| `MP_ACCESS_TOKEN` | Token Mercado Pago (Checkout Pro) |
| `LOJA_INGRESSOS_URL` | `https://ingressosbeco.raulnikroyce.dev` (back_urls MP) |
| `API_PUBLIC_URL` | `https://api-beco-underground.onrender.com` (notification_url webhook) |
| `MP_WEBHOOK_SECRET` | Opcional. "Secret Key" gerada ao cadastrar a notificação webhook no painel do Mercado Pago — se definida, a API passa a exigir a assinatura `x-signature` em `POST /ingressos/webhook` |

Em produção (`NODE_ENV=production`) o boot **recusa subir** se `CORS_ORIGIN`, `MP_ACCESS_TOKEN`, `API_PUBLIC_URL` ou `LOJA_INGRESSOS_URL` estiverem ausentes — sem essa checagem a API subia normalmente, mas o checkout ou o webhook do Mercado Pago ficavam quebrados sem nenhum erro visível na hora.

Gere o segredo no seu PC e evite colar no GitHub.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Cole o resultado só no painel do Render, **Save Changes**, depois **Manual Deploy**.

Em produção o CORS aceita só as origens listadas em `CORS_ORIGIN`.

## Aiven (MySQL)

A API no Render alcança o host público da Aiven (`*.aivencloud.com`) e a porta pública (em geral uma porta alta, distinta de 3306). MySQL na Aiven exige TLS. Use `DB_SSL=true` ou um host Aiven.

Importe `database/schema-cloud.sql` (ou rode `npm run import:schema` com as variáveis da Aiven na sessão). Em produção a API roda `npm run migrate` automaticamente no boot. Para forçar antes de um deploy, rode `npm run migrate` no PC com as variáveis da Aiven na sessão.

Evite commitar senha. Evite colar `DB_PASSWORD` no chat.

## Expiração de reservas

A própria API roda esse job internamente a cada 5 minutos (`src/jobs/agendador-expiracao.js`, iniciado em `server.js` junto com `app.listen`) — não precisa de cron externo para funcionar. Ajuste o intervalo com `INGRESSOS_EXPIRACAO_INTERVALO_MS` (em milissegundos) se quiser.

O script `npm run job:expirar-reservas` continua existindo caso prefira também um cron externo como redundância (ex.: se o processo da API ficar muito tempo sem reiniciar), mas não é mais obrigatório.

## Cadastro público (produtor)

`POST /auth/registrar` é público e sem CAPTCHA — hoje a única trava contra criação em massa de contas é um rate limit de 5 cadastros/hora por IP. Se isso não for suficiente, considere adicionar hCaptcha ou reCAPTCHA (exige criar uma conta no serviço escolhido e configurar a chave secreta na API para validar o token antes de `authService.registrar`).

## Checagem

- Painel `https://demo.raulnikroyce.dev/`
- `GET https://api-beco-underground.onrender.com/health` responde `{ "status": "ok" }` (503 se o MySQL não responder)
- `GET /openapi.json` contrato das rotas


## Migração de cancelamentos persistentes

Esta revisão adiciona `cancelamentos_ingresso` por `npm run migrate` (também no boot) e mantém os dados existentes. O SQL equivalente está em `database/migrations/007_cancelamentos_ingresso.sql`; o migrador usa sua lista explícita e não descobre arquivos SQL automaticamente. Faça backup e execute a migração antes de servir a API nova. Não remova a tabela em rollback: suas tarefas preservam a chave de estorno para conciliação. Recuar para código antigo enquanto houver tarefas pendentes pode expor ingressos suspensos; nesse caso, mantenha checkout e check-in interrompidos até reconciliar as tarefas.

A API retoma cancelamentos ao iniciar e no mesmo ciclo de cinco minutos da expiração. Mantenha ao menos uma instância ativa para essas tentativas. Se o processo cair após chamar o provedor, a lease expira em até 120 segundos; a próxima execução usa a chave original. Acompanhe os logs de cancelamento e registros pendentes com tentativas/ultimo_erro. Falhas persistentes pedem conciliação com o provedor antes de qualquer alteração manual. Publique a API com a migração antes da loja, que mostra o estado de cancelamento em processamento.
