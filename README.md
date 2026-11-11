# MotoPRO API — Heroku

API Express + TypeScript + MongoDB Atlas. Suba **o conteúdo desta pasta** na raiz de um repositório GitHub separado.

## Implantação

1. Heroku > New > Create new app (Node.js, stack atual suportada).
2. Deploy > GitHub > conectar o repositório `motopro-backend` e fazer deploy da branch principal.
3. Settings > Config Vars: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `APP_ORIGIN=https://seu-frontend.vercel.app`.
4. Opcionalmente `OPENAI_API_KEY` (transcrição por voz) e `OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe`.
5. Não configurar `PORT`: a Heroku define isso automaticamente.
6. Em Logs, confirmar conexão com Atlas. Verificar `/api/health` na URL da API.

Heroku executa `npm run build` em `heroku-postbuild` e usa `Procfile` `web: npm start` para subir `dist/index.js`.

## Importante sobre a rede do Atlas

O endereço IP de saída dos dynos comuns muda. Em produção, prefira saída com IP estático ou rede privada (quando disponível) para restringir a allowlist. Evite `0.0.0.0/0`, que permite conexões de qualquer endereço e aumenta o risco. Uma liberação ampla só deve ser considerada temporariamente para diagnóstico, com credenciais fortes e rotação.

## Segurança

Senha do MongoDB e chave JWT dos prints anteriores devem ser consideradas expostas: redefina ambas. Nunca publique `.env` nem print com credenciais.

## Comandos locais

```bash
npm install
npm run build
npm start
```


**No monorepo MotoPRO:** esta pasta chama-se `backend-MotoPRO`. Veja o arquivo `README_DEPLOY.md` da raiz para configurar Vercel e Heroku a partir de um unico repositorio.

## Fase 2 — MotoPRO v1.4.0

Rotas protegidas por sessão e Premium:
- `POST /api/assistant/transcribe`: opção `doubleCheck=true` realiza uma segunda transcrição, com custo adicional, e exige revisão se o texto divergir.
- `POST /api/receipts/analyze`: `multipart/form-data` com campo `image` (JPG/PNG/WEBP até 4 MB); análise pela OpenAI, sem armazenar a foto.
- `POST /api/receipts/:id/confirm`: usuário confere e confirma lançamento (idempotência por usuário/comprovante).
- `GET/POST/PATCH/DELETE /api/moto/maintenance-plans`: criação, consulta, registro de serviço e desativação de planos.
- `GET /api/reconciliation`: conferência da importação Rappidex contra receitas manuais (máximo 31 dias).
- `GET /api/admin/billing/system`: contagens agregadas de IA e manutenção, somente admin.

`OPENAI_API_KEY` habilita a IA. `OPENAI_RECEIPT_MODEL` é opcional (padrão: `OPENAI_COMMAND_MODEL`).
`OPENAI_INPUT_USD_PER_1M` e `OPENAI_OUTPUT_USD_PER_1M` são opcionais para estimativa de custos; não são uma fatura oficial. Fotos/áudio não são gravados pelo aplicativo. Hash e sugestões financeiras dos comprovantes expiram em 30 dias. Logs de uso armazenam apenas a funcionalidade, o resultado, o modelo e tokens (quando fornecidos).

Veja `CHECKLIST_HOMOLOGACAO_FASE2.md` na raiz do pacote antes do deploy.
