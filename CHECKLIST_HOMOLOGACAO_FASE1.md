# MotoPRO — Fase 1 — implantação e homologação

## Entregue neste ZIP
- Frontend e backend completos com código da Fase 1.
- Metas semanais e mensais, dashboard, assistente, relatórios e exportação CSV.
- Painel Admin com últimos acessos, dados cadastrados, manutenção, integrações,
  assinaturas, cortesias, pagamentos, indicadores do sistema e auditoria.
- Envio **opcional** por e-mail do fechamento da última semana concluída
  (terça a segunda), com confirmação do endereço, histórico e cancelamento.
- Agendador reexecutável e idempotente por usuário/semana com até 3 tentativas.

## Publicar em homologação (sem alterar produção de imediato)
1. Heroku: implantar os arquivos `backend-MotoPRO`, Node.js 24.x.
   Confirme `MONGODB_URI`, `JWT_SECRET`, `APP_ORIGIN`, e os segredos reais do
   Mercado Pago e do Rappidex usados pela versão atual.
2. Vercel: implantar `frontend-MotoPRO`, Node.js 24.x, e configurar
   `API_INTERNAL_URL=https://ENDERECO-REAL-DO-BACKEND` nos ambientes Preview e
   Production (sem /api e sem barra final). Fazer Redeploy após salvar.
3. Confirmar que `https://SEU-FRONTEND/api/health` retorna status `ok`.
4. Envio por e-mail (opcional): criar e verificar domínio/remetente no Resend;
   configurar **apenas no Heroku** `RESEND_API_KEY`, `REPORTS_FROM_EMAIL` e
   opcionalmente `REPORTS_BATCH_SIZE` (padrão 80, limite 200).
5. Instalar **Heroku Scheduler** e agendar `npm run reports:weekly` diariamente,
   preferencialmente às 12h UTC (= 9h de Belém). O agendador ignora envios
   anteriores a terça 8h local, cria um registro único por usuário/semana,
   e tenta até 3 vezes em falhas. A execução é por lotes.
6. O envio só acontece para motoboys que ATIVAREM a preferência na aba Relatórios
   E confirmarem o próprio e-mail. Endereço não confirmado NÃO recebe dados.
7. Nunca publique `.env` real, senhas de banco, segredos do Mercado Pago,
   tokens do Resend ou do Rappidex no GitHub.

## Roteiro de testes em homologação — obrigatório antes de produção
- [ ] Criar novo motoboy; confirmar login, celular, último login/atividade.
- [ ] Criar ganhos e despesas, incluindo abastecimento, e revisar totais diários.
- [ ] Definir metas semanal e mensal; verificar progresso e restante.
- [ ] Conferir semana fechada de terça a segunda em virada de mês/ano.
- [ ] Exportar CSV e compartilhar resumo manualmente pelo WhatsApp.
- [ ] Verificar que perfil B não consulta relatórios, metas ou dados do perfil A.
- [ ] Ativar e-mail; tentar link incorreto/expirado; confirmar o link certo.
- [ ] Executar `npm run reports:weekly` em ambiente controlado; conferir
      e-mail, datas, números e registro `sent` em Relatórios.
- [ ] Executar o agendador duas vezes; confirmar **ausência de duplicação**.
- [ ] Desativar relatórios; executar novamente e confirmar que não recebe.
- [ ] Verificar aba Admin > Sistema (assinantes de e-mail, falhas, envios).
- [ ] Em Admin > Motoboys, abrir Detalhes e conferir auditoria.
- [ ] Em Admin > Assinaturas, verificar cortesias ativas e expiradas.
- [ ] Testar Pix gerado, webhook autorizado e liberação de Premium com conta
      de homologação do Mercado Pago (sem simular aprovação pelo navegador).
- [ ] Testar expiração do plano, renovação Pix e comportamento das cortesias.
- [ ] Confirmar a sincronização de ganhos do Rappidex com conta de testes,
      conferindo que reimportações não duplicam registros.
- [ ] Testar PWA no Android e verificar redirecionamentos `/api` e cookies.

## Limites
- Sem chave do Resend e agendamento no Heroku não há envio agendado real.
- O projeto não envia mensagens automáticas de relatório pelo WhatsApp;
  o compartilhamento por WhatsApp é manual e já está disponível.
- Não foi possível executar testes reais do Mercado Pago, Rappidex,
  banco de produção ou enviar e-mails sem credenciais e ambiente do usuário.
- Substituir produção somente após os testes acima.