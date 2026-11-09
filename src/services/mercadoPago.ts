import {createHmac,timingSafeEqual} from 'node:crypto';
import {HttpError} from '../utils/http.js';

const API='https://api.mercadopago.com';
export const PREMIUM_CENTS=999;
export const premiumPriceBRL=9.99;
export function paymentConfig(){
 const token=process.env.MP_ACCESS_TOKEN || '';
 const secret=process.env.MP_WEBHOOK_SECRET || '';
 const origin=process.env.MP_PUBLIC_ORIGIN || '';
 const front=process.env.APP_ORIGIN || '';
 return {token,secret,origin,front,enabled:process.env.MP_BILLING_ENABLED==='true' && !!token && !!secret && origin.startsWith('https://')};
}
export function pixPaymentConfig(){
 const token=process.env.MP_PIX_ACCESS_TOKEN || '';
 const secret=process.env.MP_PIX_WEBHOOK_SECRET || '';
 const enabled=process.env.MP_BILLING_ENABLED==='true' && !!token && !!secret;
 return {token,secret,enabled};
}
export async function mpPix<T>(method:'GET'|'POST',path:string,payload?:unknown,idempotencyKey?:string,deviceId?:string):Promise<T>{
 const {token}=pixPaymentConfig();
 if(!token)throw new HttpError(503,'Credenciais do Pix não configuradas');
 return requestMp<T>(token,method,path,payload,idempotencyKey,deviceId);
}
export async function mp<T>(method:'GET'|'POST'|'PUT',path:string,payload?:unknown,idempotencyKey?:string):Promise<T>{
 const {token}=paymentConfig();
 return requestMp<T>(token,method,path,payload,idempotencyKey);
}
async function requestMp<T>(token:string,method:'GET'|'POST'|'PUT',path:string,payload?:unknown,idempotencyKey?:string,deviceId?:string):Promise<T>{
 if(!token)throw new HttpError(503,'Integração Mercado Pago não configurada');
 const controller=new AbortController();
 const t=setTimeout(()=>controller.abort(),12_000);
 try {
  const r=await fetch(`${API}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(idempotencyKey?{'X-Idempotency-Key':idempotencyKey}:{}),...(deviceId&&/^[A-Za-z0-9._:-]{10,200}$/.test(deviceId)?{'X-meli-session-id':deviceId}:{})},...(payload?{body:JSON.stringify(payload)}:{}),signal:controller.signal});
  const data:unknown=await r.json().catch(()=>({}));
  if(!r.ok){
   const msg=(typeof data==='object' && data!==null && 'message' in data)?String((data as {message?:unknown}).message):'';
   console.error('Mercado Pago falhou',r.status,JSON.stringify(data).slice(0,350));
   if(r.status===400 && /both payer and collector must be real or test users/i.test(msg))
     throw new HttpError(422,'Teste Mercado Pago: comprador e vendedor precisam ser ambos contas de teste. Configure MP_CREDIT_TEST_PAYER_EMAIL para o admin ou use uma conta MotoPRO de teste com e-mail do comprador.');
   throw new HttpError(502,'Mercado Pago indisponível; tente novamente');
  }
  return data as T;
 } finally {clearTimeout(t);}
}
export function verifyMercadoPagoSignature(signature:string|undefined,requestId:string|undefined,dataId:string|undefined,secret:string,now=Date.now()):boolean{
 if(!signature||!requestId||!dataId||!secret)return false;
 const parts=Object.fromEntries(signature.split(',').map(part=>part.trim().split('=',2)));
 const ts=parts.ts,v1=parts.v1;
 if(!ts||!v1||!/^\d{10,13}$/.test(ts)||!/^[a-fA-F0-9]{64}$/.test(v1))return false;
 const sent=Number(ts)*(ts.length===10?1000:1);
 if(!Number.isFinite(sent)||Math.abs(now-sent)>5*60*1000)return false;
 const manifest=`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
 const expected=createHmac('sha256',secret).update(manifest).digest();
 return timingSafeEqual(Buffer.from(v1,'hex'),expected);
}
export type MpPix={id:number|string;status:string;transaction_details?:{external_resource_url?:string};point_of_interaction?:{transaction_data?:{qr_code?:string;qr_code_base64?:string;ticket_url?:string}};date_of_expiration?:string;external_reference?:string;transaction_amount?:number;payment_method_id?:string;preapproval_id?:string};
export type MpSubscription={id:string;status:string;external_reference?:string};
export type MpAuthorizedPayment={id:string|number;status:string;preapproval_id?:string;transaction_amount?:number;payment?:{id?:string|number;status?:string};};

/** Orders API do Checkout Transparente: Pix avulso, sem débito automático. */
export interface MpPixOrder {
 id:string;
 external_reference?:string;
 total_amount?:string;
 status:string;
 status_detail?:string;
 transactions?:{payments?:Array<{
  id?:string;
  amount?:string;
  status?:string;
  status_detail?:string;
  payment_method?:{id?:string;type?:string;qr_code?:string;qr_code_base64?:string;ticket_url?:string};
 }>};
}
