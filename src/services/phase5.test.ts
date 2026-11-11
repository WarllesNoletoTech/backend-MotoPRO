import assert from 'node:assert/strict';
import test from 'node:test';
import {createECDH,createDecipheriv,createPublicKey,hkdfSync,verify} from 'node:crypto';
import {allowedPushEndpoint,encryptWebPush,makeVapidToken,pushConfigured,validatePushSubscription} from './webPush.js';
import {protectBrowserWrites} from './csrf.js';

test('Web Push restringe endpoints à lista oficial e rejeita SSRF',()=>{
 assert.equal(allowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'),true);
 assert.equal(allowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/test'),true);
 for(const v of ['http://127.0.0.1','https://127.0.0.1','https://fcm.googleapis.com.attacker.org/foo',
  'https://localhost:8080/','https://user:pass@fcm.googleapis.com/','https://fcm.googleapis.com:8443/']){
  assert.equal(allowedPushEndpoint(v),false,v);
 }
});
test('Web Push cifra o payload com aes128gcm da RFC 8291, descriptografável pelo destinatário',()=>{
 const ua=createECDH('prime256v1');ua.generateKeys();
 const receiverPub=ua.getPublicKey();
 const auth=Buffer.alloc(16,9);
 const message=JSON.stringify({title:'MotoPRO',body:'Avisos',url:'/app/avisos'});
 const result=encryptWebPush(message,receiverPub,auth);
 const salt=result.subarray(0,16);
 assert.equal(result.readUInt32BE(16),4096);
 assert.equal(result[20],65);
 const serverPub=result.subarray(21,86);
 const shared=ua.computeSecret(serverPub);
 const info=Buffer.concat([Buffer.from('WebPush: info\0'),receiverPub,serverPub]);
 const ikm=Buffer.from(hkdfSync('sha256',shared,auth,info,32));
 const key=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
 const iv=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
 const body=result.subarray(86);const ciphertext=body.subarray(0,-16);
 const decipher=createDecipheriv('aes-128-gcm',key,iv);
 decipher.setAuthTag(body.subarray(-16));
 const text=Buffer.concat([decipher.update(ciphertext),decipher.final()]);
 assert.equal(text[text.length-1],2);
 assert.equal(text.subarray(0,-1).toString(),message);
});
test('VAPID JWT é assinado pela chave pública anunciada',()=>{
 const key=createECDH('prime256v1');key.generateKeys();
 const saved=[process.env.PUSH_VAPID_PUBLIC_KEY,process.env.PUSH_VAPID_PRIVATE_KEY,process.env.PUSH_CONTACT_EMAIL];
 process.env.PUSH_VAPID_PUBLIC_KEY=key.getPublicKey().toString('base64url');
 process.env.PUSH_VAPID_PRIVATE_KEY=key.getPrivateKey().toString('base64url');
 process.env.PUSH_CONTACT_EMAIL='suporte@example.com';
 try{
  assert.equal(pushConfigured(),true);
  const jwt=makeVapidToken('https://fcm.googleapis.com/fcm/send/abc',1000);
  const [header,payload,sig]=jwt.split('.');
  assert.equal(JSON.parse(Buffer.from(payload,'base64url').toString()).aud,'https://fcm.googleapis.com');
  const pub=key.getPublicKey();
  const jwk={kty:'EC',crv:'P-256',x:pub.subarray(1,33).toString('base64url'),y:pub.subarray(33).toString('base64url')};
  const publicKey=createPublicKey({key:jwk,format:'jwk'});
  assert.equal(verify('sha256',Buffer.from(`${header}.${payload}`),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url')),true);
  validatePushSubscription({endpoint:'https://fcm.googleapis.com/fcm/send/abc',keys:{auth:Buffer.alloc(16).toString('base64url'),p256dh:pub.toString('base64url')}});
 }finally{
  if(saved[0]===undefined)delete process.env.PUSH_VAPID_PUBLIC_KEY;else process.env.PUSH_VAPID_PUBLIC_KEY=saved[0];
  if(saved[1]===undefined)delete process.env.PUSH_VAPID_PRIVATE_KEY;else process.env.PUSH_VAPID_PRIVATE_KEY=saved[1];
  if(saved[2]===undefined)delete process.env.PUSH_CONTACT_EMAIL;else process.env.PUSH_CONTACT_EMAIL=saved[2];
 }
});
test('CSRF recusa origin incompatível e mantém assinatura de webhook independente',()=>{
 const orig=process.env.APP_ORIGIN;
 process.env.APP_ORIGIN='http://localhost:3000';
 const request=(path:string,method:string,headers:Record<string,string>)=>({path,method,header:(key:string)=>headers[key]||undefined}) as any;
 const run=(path:string,method:string,headers:Record<string,string>)=>{
  let status=0;let next=false;
  const res={status:(n:number)=>{status=n;return res;},json:()=>res} as any;
  protectBrowserWrites(request(path,method,headers),res,()=>{next=true;});
  return {status,next};
 };
 assert.deepEqual(run('/api/billing/pix','POST',{'origin':'https://evil.example'}),{status:403,next:false});
 assert.deepEqual(run('/api/billing/pix','POST',{'sec-fetch-site':'cross-site'}),{status:403,next:false});
 assert.deepEqual(run('/api/billing/pix','POST',{'origin':'http://localhost:3000'}),{status:0,next:true});
 assert.deepEqual(run('/api/webhooks/mercadopago/orders','POST',{'origin':'https://provider.example','sec-fetch-site':'cross-site'}),{status:0,next:true});
 if(orig===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=orig;
});
