import test from 'node:test';
import assert from 'node:assert/strict';
import {oneSignalAppId,oneSignalSendingReady,sendOneSignalNotice} from './oneSignal.js';
const testId='ba3a7a92-8c34-4891-94fd-a52a4fc8dddb';
test('OneSignal só publica identificadores de aplicativo UUID válidos',()=>{
 const old=process.env.ONESIGNAL_APP_ID;
 try{
  process.env.ONESIGNAL_APP_ID='fake-app';assert.equal(oneSignalAppId(),null);
  process.env.ONESIGNAL_APP_ID=testId;assert.equal(oneSignalAppId(),testId);
 }finally{if(old===undefined)delete process.env.ONESIGNAL_APP_ID;else process.env.ONESIGNAL_APP_ID=old;}
});
test('OneSignal exige chave REST para que o agendador envie avisos',()=>{
 const oldId=process.env.ONESIGNAL_APP_ID,oldKey=process.env.ONESIGNAL_REST_API_KEY;
 try{
  process.env.ONESIGNAL_APP_ID=testId;
  delete process.env.ONESIGNAL_REST_API_KEY;assert.equal(oneSignalSendingReady(),false);
  process.env.ONESIGNAL_REST_API_KEY='';assert.equal(oneSignalSendingReady(),false);
  process.env.ONESIGNAL_REST_API_KEY='test-only-long-fake-key';assert.equal(oneSignalSendingReady(),true);
 }finally{
  if(oldId===undefined)delete process.env.ONESIGNAL_APP_ID;else process.env.ONESIGNAL_APP_ID=oldId;
  if(oldKey===undefined)delete process.env.ONESIGNAL_REST_API_KEY;else process.env.ONESIGNAL_REST_API_KEY=oldKey;
 }
});

test('aviso individual OneSignal usa somente IDs de assinatura confirmados, sem aliases do cliente',async()=>{
 const oldId=process.env.ONESIGNAL_APP_ID,oldKey=process.env.ONESIGNAL_REST_API_KEY,oldOrigin=process.env.APP_ORIGIN;
 const originalFetch=globalThis.fetch;
 try{
  process.env.ONESIGNAL_APP_ID=testId;
  process.env.ONESIGNAL_REST_API_KEY='test-only-long-fake-key';
  process.env.APP_ORIGIN='https://motopro.example.com';
  let count=0;
  globalThis.fetch=(async (url,options)=>{
   assert.equal(url,'https://api.onesignal.com/notifications');
   const body=JSON.parse(String(options?.body));
   assert.deepEqual(body.include_subscription_ids,['6674b44e-485e-4ffd-bede-6413b079bb8e']);
   assert.equal(body.include_aliases,undefined);
   assert.equal(body.target_channel,undefined);
   assert.match(body.contents.pt,/aviso/);
   assert.equal(body.chrome_web_icon,'https://motopro.example.com/icon-192.png');
   assert.ok(!JSON.stringify(body).includes('ganhou R$'));
   count++;
   return new Response(JSON.stringify({id:'mock-id'}),{status:200,headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  await sendOneSignalNotice(['6674b44e-485e-4ffd-bede-6413b079bb8e'],2);
  assert.equal(count,1);
 }finally{
  globalThis.fetch=originalFetch;
  if(oldId===undefined)delete process.env.ONESIGNAL_APP_ID;else process.env.ONESIGNAL_APP_ID=oldId;
  if(oldKey===undefined)delete process.env.ONESIGNAL_REST_API_KEY;else process.env.ONESIGNAL_REST_API_KEY=oldKey;
  if(oldOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=oldOrigin;
 }
});
