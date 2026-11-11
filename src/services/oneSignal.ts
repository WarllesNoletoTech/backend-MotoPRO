import type {PushMessage} from './notificationMessages.js';

/** Integração opcional: a REST API Key jamais vai ao navegador. */
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function oneSignalAppId(){
 const id=(process.env.ONESIGNAL_APP_ID||'').trim();
 return idPattern.test(id)?id:null;
}
export function oneSignalSendingReady(){
 return Boolean(oneSignalAppId()&&(process.env.ONESIGNAL_REST_API_KEY||'').trim().length>12);
}
export async function sendOneSignalNotice(subscriptionIds:string[],payload:number|PushMessage){
 const id=oneSignalAppId(),key=(process.env.ONESIGNAL_REST_API_KEY||'').trim();
 if(!id||!key)throw new Error('OneSignal não configurado para envio (App ID e REST API Key)');
 if(!subscriptionIds.length||subscriptionIds.length>20||subscriptionIds.some(x=>!idPattern.test(x)))throw new Error('Lista de dispositivos OneSignal inválida');
 const msg:PushMessage=typeof payload==='number'
  ? {category:'summary',title:'MotoPRO · Avisos',body:`Você tem ${payload} aviso(s) para conferir no MotoPRO.`,url:'/app/avisos'}
  : payload;
 const origin=(process.env.APP_ORIGIN||'').trim().replace(/\/$/,'');
 if(!/^https:\/\/[^/]+$/.test(origin))throw new Error('Configure APP_ORIGIN com a origem HTTPS da Vercel');
 const response=await fetch('https://api.onesignal.com/notifications',{
  method:'POST',headers:{'Authorization':`Key ${key}`,'Content-Type':'application/json'},
  body:JSON.stringify({app_id:id,include_subscription_ids:subscriptionIds,
   headings:{en:msg.title,pt:msg.title},contents:{en:msg.body,pt:msg.body},
   url:`${origin}${msg.url}`,chrome_web_icon:`${origin}/icon-192.png`,
   name:msg.category==='test'?'Teste administrativo MotoPRO':`MotoPRO · ${msg.category}`}),signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw new Error(`OneSignal HTTP ${response.status}`);
 const result=await response.json() as {id?:string;errors?:unknown};
 if(!result.id)throw new Error('OneSignal não aceitou a notificação');
 return {id:result.id};
}
