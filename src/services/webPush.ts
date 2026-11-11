import {createECDH,createPrivateKey,randomBytes,createCipheriv,hkdfSync,sign} from 'node:crypto';
import {HttpError} from '../utils/http.js';

const decode=(value:string)=>Buffer.from(value,'base64url');
export function allowedPushEndpoint(endpoint:string){
 try{
  const u=new URL(endpoint);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||endpoint.length>1800)return false;
  // Lista restrita: evita SSRF contra endereços internos ou controlados pelo usuário.
  return ['fcm.googleapis.com','updates.push.services.mozilla.com','push.services.mozilla.com','web.push.apple.com'].includes(u.hostname);
 }catch{return false;}
}
export function pushConfigured(){
 const pub=process.env.PUSH_VAPID_PUBLIC_KEY||'';
 const priv=process.env.PUSH_VAPID_PRIVATE_KEY||'';
 const contact=process.env.PUSH_CONTACT_EMAIL||'';
 return decode(pub).length===65 && decode(pub)[0]===4 && decode(priv).length===32 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
}
export function publicPushKey(){return pushConfigured()?process.env.PUSH_VAPID_PUBLIC_KEY!:null;}
export function validatePushSubscription(s:{endpoint:string;keys:{auth:string;p256dh:string}}){
 if(!allowedPushEndpoint(s.endpoint))throw new HttpError(400,'Servidor de notificação incompatível');
 if(decode(s.keys.auth).length!==16 || decode(s.keys.p256dh).length!==65 || decode(s.keys.p256dh)[0]!==4)throw new HttpError(400,'Chaves de notificação inválidas');
}
export function encryptWebPush(content:string,receiverPub:Buffer,auth:Buffer){
 const server=createECDH('prime256v1');server.generateKeys();
 const serverPub=server.getPublicKey();
 const shared=server.computeSecret(receiverPub);
 const info=Buffer.concat([Buffer.from('WebPush: info\0'),receiverPub,serverPub]);
 const ikm=Buffer.from(hkdfSync('sha256',shared,auth,info,32));
 const salt=randomBytes(16);
 const cek=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
 const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
 const data=Buffer.concat([Buffer.from(content,'utf8'),Buffer.from([2])]); // RFC 8188 final record marker.
 if(data.length>3000)throw new Error('Notificação muito grande');
 const cipher=createCipheriv('aes-128-gcm',cek,nonce);
 const encrypted=Buffer.concat([cipher.update(data),cipher.final(),cipher.getAuthTag()]);
 const header=Buffer.alloc(16+4+1);
 salt.copy(header,0);header.writeUInt32BE(4096,16);header[20]=serverPub.length;
 return Buffer.concat([header,serverPub,encrypted]);
}
export function makeVapidToken(endpoint:string,now=Math.floor(Date.now()/1000)){
 if(!pushConfigured())throw new Error('Notificações Web Push não configuradas');
 const secret=decode(process.env.PUSH_VAPID_PRIVATE_KEY!);
 const publicKey=decode(process.env.PUSH_VAPID_PUBLIC_KEY!);
 const jwk={kty:'EC',crv:'P-256',d:secret.toString('base64url'),x:publicKey.subarray(1,33).toString('base64url'),y:publicKey.subarray(33).toString('base64url')};
 const header=Buffer.from(JSON.stringify({typ:'JWT',alg:'ES256'})).toString('base64url');
 const aud=new URL(endpoint).origin;
 const payload=Buffer.from(JSON.stringify({aud,exp:now+3600,sub:`mailto:${process.env.PUSH_CONTACT_EMAIL}`})).toString('base64url');
 const message=`${header}.${payload}`;
 const signature=sign('sha256',Buffer.from(message),{key:createPrivateKey({key:jwk,format:'jwk'}),dsaEncoding:'ieee-p1363'});
 return `${message}.${signature.toString('base64url')}`;
}
export async function sendWebPush(s:{endpoint:string;keys:{p256dh:string;auth:string}},message:{title:string;body:string;url:string}){
 validatePushSubscription(s);
 const publicKey=publicPushKey();if(!publicKey)throw new Error('Notificações Web Push não configuradas');
 const data=encryptWebPush(JSON.stringify(message),decode(s.keys.p256dh),decode(s.keys.auth));
 const response=await fetch(s.endpoint,{method:'POST',headers:{
  'Authorization':`vapid t=${makeVapidToken(s.endpoint)}, k=${publicKey}`,
  'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',
  'TTL':'43200','Urgency':'normal'
 },body:new Uint8Array(data),signal:AbortSignal.timeout(10000)});
 // Endpoint expirado, cliente deve reativar no app.
 if(response.status===404||response.status===410)return {expired:true};
 if(!response.ok)throw new Error(`Push endpoint HTTP ${response.status}`);
 return {expired:false};
}
