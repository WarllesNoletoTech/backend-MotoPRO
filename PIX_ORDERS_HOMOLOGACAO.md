# MotoPRO PIX — Orders API (Checkout Transparente)

**Versão para homologação, ainda não publicada.** Não inclui credenciais e não executa cobranças sem chaves de teste válidas.

## Como funciona
- Pix semanal de R$ 9,99 (ou preço semanal configurado no painel). É **Pix avulso**, não Pix Automático.
- `POST /api/billing/pix` cria uma order no Mercado Pago `/v1/orders` via `MP_PIX_ACCESS_TOKEN`.
- `POST /api/webhooks/mercadopago/orders` valida a assinatura `MP_PIX_WEBHOOK_SECRET`, consulta a order com a API e aplica o acesso somente quando `processed/accredited`.
- A cobrança de cartão em `/preapproval` continua usando `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`.
- O banco registra `providerOrderId` para não confundir Orders API com Payments API antiga.

## Config Vars — Heroku em homologação
```
NODE_ENV=production
MP_BILLING_ENABLED=false
MP_ENFORCE_PREMIUM=false
MP_ACCESS_TOKEN=<TOKEN_TESTE_ASSINATURAS>
MP_WEBHOOK_SECRET=<SEGREDO_TESTE_ASSINATURAS>
MP_PIX_ACCESS_TOKEN=<TOKEN_TESTE_MOTOPRO_PIX>
MP_PIX_WEBHOOK_SECRET=<SEGREDO_TESTE_MOTOPRO_PIX>
MP_PUBLIC_ORIGIN=https://motopro-cc33b74592eb.herokuapp.com
APP_ORIGIN=https://frontend-moto-pro.vercel.app
```
Mantenha a JWT e a URI do MongoDB existentes. Nunca versionar senhas/tokens. Configure a URL de teste do MotoPRO PIX como `https://motopro-cc33b74592eb.herokuapp.com/api/webhooks/mercadopago/orders`, evento **Order (Mercado Pago)**.

## Testes de segurança antes da ativação
1. `npm install` e `npm run build` devem passar.
2. Confirme que `GET /api/health` responde após o deploy na branch de homologação.
3. Habilite `MP_BILLING_ENABLED=true` **somente em ambiente de teste isolado e sem usuários reais**.
4. Gere um Pix de teste por usuário de teste. O QR e o código Copia e Cola precisam aparecer.
5. Simule pagamento autorizado pelo Mercado Pago; aguarde webhook válido e clique em Verificar confirmação.
6. Verifique no MongoDB `billingpayments` status `approved` e `billingsubscriptions` com 7 dias. Reenvio do webhook não deve somar novos 7 dias.
7. Teste falsificação de assinatura e valor: o pagamento não pode ser aprovado.
8. Teste Pix pendente, expirado, reembolsado e repetição da notificação.
9. Teste separadamente o fluxo de crédito recorrente, inclusive cancelamento.

**Avisos:** reembolso/estorno requer conciliação administrativa e revisão de acesso. O teste de Pix por API Orders pode ter exigências de titularidade e credenciais específicas; nenhum comportamento real foi confirmado neste pacote. O provedor pode responder assincronamente ao criar a order.
