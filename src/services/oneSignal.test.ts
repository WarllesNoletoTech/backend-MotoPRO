import test from 'node:test';
import assert from 'node:assert/strict';
import {oneSignalAppId,oneSignalSendingReady} from './oneSignal.js';
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
