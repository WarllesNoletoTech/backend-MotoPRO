/** Regras puras de vencimento, independentes de jobs, Heroku e fuso horário. */
export const DAY_MS = 86400_000;
export const REMINDER_WINDOW_MS = 2 * DAY_MS;
export type SubscriptionNotice = {
  status: 'none'|'active'|'expiring'|'expired'|'trial'|'courtesy';
  title: string;
  message: string;
  activeUntil: string|null;
  renewalAllowed: boolean;
  remainingDays: number|null;
};
export function subscriptionNotice(input:{paidUntil?:Date|string|null;trialUntil?:Date|string|null;courtesyUntil?:Date|string|null},now:Date=new Date()):SubscriptionNotice{
 const current=now.getTime();
 const paid=Number.isFinite(new Date(input.paidUntil||'').getTime())?new Date(input.paidUntil!).getTime():0;
 const trial=Number.isFinite(new Date(input.trialUntil||'').getTime())?new Date(input.trialUntil!).getTime():0;
 const courtesy=Number.isFinite(new Date(input.courtesyUntil||'').getTime())?new Date(input.courtesyUntil!).getTime():0;
 const fmt=(ms:number)=>new Date(ms).toISOString();
 const day=(ms:number)=>Math.max(0,Math.ceil((ms-current)/DAY_MS));
 const renewalAllowed=paid<=current+REMINDER_WINDOW_MS;
 if(paid>current){
  const soon=paid-current<=REMINDER_WINDOW_MS;
  return {status:soon?'expiring':'active',title:soon?'Seu Premium vence em breve':'Premium ativo',
   message:soon?'Renove pelo Pix para continuar usando os benefícios sem interrupção.':'Seu acesso Premium está ativo.',
   activeUntil:fmt(paid),renewalAllowed,remainingDays:day(paid)};
 }
 if(courtesy>current)return {status:'courtesy',title:'Cortesia ativa',message:'Sua cortesia está válida até a data indicada.',activeUntil:fmt(courtesy),renewalAllowed:true,remainingDays:day(courtesy)};
 if(trial>current)return {status:'trial',title:'Período gratuito ativo',message:'Você pode renovar pelo Pix quando desejar.',activeUntil:fmt(trial),renewalAllowed:true,remainingDays:day(trial)};
 if(paid>0)return {status:'expired',title:'Seu Premium venceu',message:'Renove pelo Pix para reativar os benefícios Premium.',activeUntil:fmt(paid),renewalAllowed:true,remainingDays:0};
 return {status:'none',title:'Ative seu Premium',message:'Pague por Pix para começar a usar os benefícios Premium.',activeUntil:null,renewalAllowed:true,remainingDays:null};
}
