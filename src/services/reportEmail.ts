import {createHash,randomBytes} from 'node:crypto';
import {addDays,dateInTimezone,weekRangeTuesday} from '../utils/dates.js';

export const reportEmailConfigured=()=>Boolean(process.env.RESEND_API_KEY?.trim() && process.env.REPORTS_FROM_EMAIL?.trim());
export const newVerificationToken=()=>randomBytes(32).toString('hex');
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');

/** Última semana FECHADA, terça até segunda, respeitando o fuso do usuário. */
export function lastClosedWeek(today:string){
 const current=weekRangeTuesday(today);
 const from=addDays(current.from,-7);
 return {from,to:addDays(from,6)};
}
export function isReportWindowOpen(instant:Date,timezone:string){
 try{
  const day=dateInTimezone(timezone,instant);
  const weekday=new Date(`${day}T00:00:00.000Z`).getUTCDay();
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',hourCycle:'h23'}).formatToParts(instant);
  const hour=Number(parts.find(p=>p.type==='hour')?.value??0);
  return weekday!==2 || hour>=8;
 }catch{return false;}
}
export const formatBRL=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export function weeklyEmailText(input:{name:string;from:string;to:string;incomeCents:number;expenseCents:number;profitCents:number;entriesCount:number;integratedCount:number}){
 const name=input.name.split(' ')[0]||'Entregador';
 return [
  `Olá, ${name}!`,
  '',
  `Seu fechamento semanal MotoPRO: ${input.from} a ${input.to}.`,
  `Ganhos registrados: ${formatBRL(input.incomeCents)}`,
  `Despesas registradas: ${formatBRL(input.expenseCents)}`,
  `Lucro estimado: ${formatBRL(input.profitCents)}`,
  `Lançamentos: ${input.entriesCount} (${input.integratedCount} importados).`,
  '',
  'Os valores dependem dos lançamentos cadastrados e podem não incluir todas as despesas.',
  'Consulte os detalhes no aplicativo MotoPRO, na aba Relatórios.',
  'Você pode desativar esses e-mails na própria aba Relatórios.'
 ].join('\n');
}

/** Envio por Resend, sem expor token em logs. A chave de idempotência é estável para reexecuções. */
export async function sendReportEmail(to:string,subject:string,text:string,idempotencyKey:string){
 const key=process.env.RESEND_API_KEY?.trim();
 const from=process.env.REPORTS_FROM_EMAIL?.trim();
 if(!key||!from)throw new Error('Envio de e-mails não configurado');
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',signal:AbortSignal.timeout(15000),
  headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
  body:JSON.stringify({from,to:[to],subject,text})
 });
 if(!response.ok)throw new Error(`Provedor de e-mail indisponível (HTTP ${response.status})`);
 const body=await response.json() as {id?:string};
 if(!body.id)throw new Error('Provedor não confirmou a solicitação');
 return body.id;
}
