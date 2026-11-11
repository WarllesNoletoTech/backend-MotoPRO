import {notificationDefaults,type NotificationKind,type NotificationSettings,type NotificationTemplate} from '../models/NotificationSetting.js';
import type {Alert} from './alertCenter.js';

export type PushMessage={title:string;body:string;url:'/app/avisos'|'/app/moto'|'/app/recorrentes'|'/app/particulares'|'/app/assinatura'|'/app/admin';category:NotificationKind|'test'};
export const categoryUrls:Record<NotificationKind,PushMessage['url']>={
 summary:'/app/avisos',maintenance:'/app/moto',recurring:'/app/recorrentes',receivables:'/app/particulares',subscription:'/app/assinatura'
};
export const kindForAlert=(id:string):Exclude<NotificationKind,'summary'>|null=>{
 if(id.startsWith('maintenance-')||id.startsWith('reminder-'))return 'maintenance';
 if(id.startsWith('recurrence-'))return 'recurring';
 if(id==='private-pending')return 'receivables';
 return null;
};
export function buildPushMessage(kind:NotificationKind,template:NotificationTemplate,count:number):PushMessage{
 const safeCount=Math.max(1,Math.min(999,Math.floor(count||1)));
 const render=(text:string)=>text.replaceAll('{quantidade}',String(safeCount));
 return {category:kind,title:render(template.title).trim(),body:render(template.body).trim(),url:categoryUrls[kind]};
}
/** Não inclui nomes, valores, descrição financeira nem dados pessoais em push. */
export function dailyPushMessage(alerts:Alert[],subscriptionExpiring:boolean,settings:NotificationSettings):PushMessage|null{
 if(!settings.enabled)return null;
 const enabledKinds=new Set<NotificationKind>();
 for(const alert of alerts){const kind=kindForAlert(alert.id);if(kind&&settings.categories[kind])enabledKinds.add(kind);}
 if(subscriptionExpiring&&settings.categories.subscription)enabledKinds.add('subscription');
 if(enabledKinds.size===0)return null;
 const priority:NotificationKind[]=['subscription','maintenance','receivables','recurring'];
 const kind=priority.find(k=>enabledKinds.has(k))||'summary';
 const count=alerts.filter(a=>{const k=kindForAlert(a.id);return Boolean(k&&settings.categories[k]);}).length+(subscriptionExpiring&&settings.categories.subscription?1:0);
 // Para vários tipos diferentes, redirecionar à central, evitando esconder outras pendências.
 if(enabledKinds.size>1)return buildPushMessage('summary',settings.templates.summary,count);
 return buildPushMessage(kind,settings.templates[kind]||notificationDefaults.templates[kind],count);
}
