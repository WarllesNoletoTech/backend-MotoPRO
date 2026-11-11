import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationDefaults} from '../models/NotificationSetting.js';
import {buildPushMessage,dailyPushMessage,kindForAlert} from './notificationMessages.js';
import type {Alert} from './alertCenter.js';

const alert=(id:string):Alert=>({id,level:'warning',title:'Exemplo confidencial R$ 1000',description:'Detalhe privado',href:'/app/avisos'});
test('mensagens personalizadas substituem apenas a quantidade e preservam links permitidos',()=>{
 const message=buildPushMessage('summary',{title:'MotoPRO',body:'Você tem {quantidade} aviso(s)'},4);
 assert.deepEqual(message,{category:'summary',title:'MotoPRO',body:'Você tem 4 aviso(s)',url:'/app/avisos'});
});
test('notificação não revela títulos privados dos alertas e prioriza manutenção',()=>{
 const msg=dailyPushMessage([alert('maintenance-abc')],false,notificationDefaults);
 assert.ok(msg);assert.equal(msg.category,'maintenance');assert.equal(msg.url,'/app/moto');
 assert.ok(!JSON.stringify(msg).includes('R$ 1000'));
});
test('quando há várias categorias usa resumo sem detalhes pessoais',()=>{
 const msg=dailyPushMessage([alert('maintenance-abc'),alert('private-pending')],false,notificationDefaults);
 assert.ok(msg);assert.equal(msg.category,'summary');assert.match(msg.body,/2 aviso/);
});
test('categoria desativada não dispara push e não suprime avisos na tela',()=>{
 const settings={...notificationDefaults,categories:{...notificationDefaults.categories,maintenance:false}};
 assert.equal(dailyPushMessage([alert('maintenance-abc')],false,settings),null);
 assert.equal(kindForAlert('reminder-42'),'maintenance');
});
test('assinatura vencendo gera aviso independentemente de outras pendências',()=>{
 const msg=dailyPushMessage([],true,notificationDefaults);
 assert.ok(msg);assert.equal(msg.category,'subscription');assert.equal(msg.url,'/app/assinatura');
});
test('desligar avisos automáticos impede disparo',()=>{
 assert.equal(dailyPushMessage([alert('private-pending')],true,{...notificationDefaults,enabled:false}),null);
});
