/** Regra única de acesso: configurada e auditada no painel administrativo. */
export type PremiumStatus = 'none'|'active'|'expiring'|'expired'|'trial'|'courtesy';
export function premiumAccessFor(status:PremiumStatus, premiumRequired:boolean, isAdmin:boolean){
 return {premiumRequired,allowed:isAdmin||!premiumRequired||['active','expiring','trial','courtesy'].includes(status)};
}

/** Dias gratuitos definidos pelo administrador no instante do cadastro. Zero = nenhuma cortesia. */
export function trialEndsAtFromDays(days:number, now:Date=new Date()):Date|null{
 if(!Number.isInteger(days)||days<0||days>30)throw new RangeError('Dias de teste inválidos (0 a 30)');
 return days===0?null:new Date(now.getTime()+days*86400_000);
}
