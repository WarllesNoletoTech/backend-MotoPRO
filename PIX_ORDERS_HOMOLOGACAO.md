# MotoPRO PIX — Orders API (Checkout Transparente)

**Somente homologação: não publicamos nem habilitamos cobranças reais.**

- `POST /api/billing/pix` usa `MP_PIX_ACCESS_TOKEN` e tenta criar order em `/v1/orders`.
- Webhook: `POST /api/webhooks/mercadopago/orders`, evento **Order (Mercado Pago)**, assinatura secreta `MP_PIX_WEBHOOK_SECRET`.
- O backend consulta a order e só considera a cobrança aprovada após verificar referência, valor, método Pix e estado processado/creditado.
- O checkout de crédito mantém `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` separados.
- Esse fluxo é **Pix avulso semanal**, não Pix Automático.

## Heroku (somente em ambiente de teste isolado)

```env
MP_BILLING_ENABLED=false
MP_ENFORCE_PREMIUM=false
MP_ACCESS_TOKEN=<TOKEN_TESTE_ASSINATURAS>
MP_WEBHOOK_SECRET=<SEGREDO_TESTE_ASSINATURAS>
MP_PIX_ACCESS_TOKEN=<TOKEN_TESTE_MOTOPRO_PIX>
MP_PIX_WEBHOOK_SECRET=<SEGREDO_TESTE_MOTOPRO_PIX>
MP_PUBLIC_ORIGIN=https://motopro-cc33b74592eb.herokuapp.com
APP_ORIGIN=https://frontend-moto-pro.vercel.app
```

Mantenha as atuais JWT e MONGODB_URI seguras; não envie arquivos .env ao Git. Antes de ativar MP_BILLING_ENABLED, valide build, payload Orders API, callbacks assinados, pagamentos pendentes/aprovados/cancelados/reembolsados, eventos duplicados, autorização do usuário e cancelamento do cartão, usando exclusivamente contas e credenciais de teste.

**Limitações:** build completo e chamadas reais ao Mercado Pago não foram executados neste ambiente; o payload e os estados de Orders devem ser homologados contra as respostas da sua conta antes de publicar. Não troque tokens de produção nem habilite cobranças em conta usada por clientes reais.
