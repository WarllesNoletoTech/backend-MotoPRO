# MotoPRO — correção de assinatura no cartão de crédito

Correção aplicada no arquivo `src/routes/billing.ts`:

- Antes: `frequency: 1`, `frequency_type: 'weeks'` — rejeitado pelo Mercado Pago (HTTP 400).
- Agora: `frequency: 7`, `frequency_type: 'days'` — intervalo semanal aceito pela API.
- Plano: R$ 9,99 a cada sete dias, conforme valor configurado no administrador.

O pacote completo contém o backend MotoPRO V3.3 (Pix Orders + crédito). O patch contém somente o arquivo corrigido, para substituir no backend existente.

Não inclui arquivos `.env` privados ou `node_modules`. Publicar no GitHub somente depois de revisar o diff e executar `npm install` e `npm run build` no diretório do backend. Homologar o crédito no Mercado Pago com credenciais de teste antes de ativar produção.
