/** Integração opcional: nunca expor a REST API Key ao navegador. */
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function oneSignalAppId(){
 const id=(process.env.ONESIGNAL_APP_ID||'').trim();
 return idPattern.test(id)?id:null;
}
export function oneSignalSendingReady(){
 return Boolean(oneSignalAppId()&&(process.env.ONESIGNAL_REST_API_KEY||'').trim().length>12);
}
export async function sendOneSignalNotice(subscriptionIds:string[],count:number){
 const id=oneSignalAppId(),key=(process.env.ONESIGNAL_REST_API_KEY||'').trim();
 if(!id||!key)throw new Error('OneSignal não configurado para envio (App ID e REST API Key)');
 if(!subscriptionIds.length||subscriptionIds.length>20)throw new Error('Lista de dispositivos OneSignal inválida');
 const response=await fetch('https://api.onesignal.com/notifications',{
  method:'POST',headers:{'Authorization':`Key ${key}`,'Content-Type':'application/json'},
  body:JSON.stringify({app_id:id,include_subscription_ids:subscriptionIds,
   headings:{en:'MotoPRO · Avisos',pt:'MotoPRO · Avisos'},contents:{en:`Você tem ${count} aviso(s) para conferir no MotoPRO.`,pt:`Você tem ${count} aviso(s) para conferir no MotoPRO.`},
   url:`${(process.env.APP_ORIGIN||'').replace(/\/$/,'')}/app/avisos`,
   name:'Avisos diários MotoPRO'}),signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw new Error(`OneSignal HTTP ${response.status}`);
 const result=await response.json() as {id?:string;errors?:unknown};
 if(!result.id)throw new Error('OneSignal não aceitou a notificação');
 return {id:result.id};
}
