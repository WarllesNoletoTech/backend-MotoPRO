/** Direitos Premium: um prazo válido, cortesia vigente ou pagamento aprovado, nunca uma preferência antiga que libera todos. */
export type PremiumStatus = 'none'|'active'|'expiring'|'expired'|'trial'|'courtesy';
const ENTITLED: ReadonlySet<PremiumStatus>=new Set(['active','expiring','trial','courtesy']);
export function premiumAccessFor(status:PremiumStatus, _legacyPremiumRequired:boolean, isAdmin:boolean){
 return {premiumRequired:true,allowed:isAdmin||ENTITLED.has(status)};
}

/** Prazo de teste global calculado desde a criação; alterações do admin têm efeito imediato. */
export function trialEndsAtFromDays(days:number, createdAt:Date=new Date()):Date|null{
 if(!Number.isInteger(days)||days<0||days>30)throw new RangeError('Dias de teste inválidos (0 a 30)');
 if(!Number.isFinite(createdAt.getTime()))return null;
 return days===0?null:new Date(createdAt.getTime()+days*86400_000);
}
/** Sem createdAt válido, não cria acesso grátis por engano. Ignora prazos antigos gravados na conta. */
export function currentTrialUntil(createdAt:Date|string|null|undefined,days:number):Date|null{
 if(!createdAt)return null;
 const d=createdAt instanceof Date?createdAt:new Date(createdAt);
 return trialEndsAtFromDays(days,d);
}
