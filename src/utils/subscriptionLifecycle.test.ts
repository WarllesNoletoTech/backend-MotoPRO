import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MS,subscriptionNotice} from './subscriptionLifecycle.js';
const now=new Date('2026-11-09T12:00:00Z');
const after=(n:number)=>new Date(now.getTime()+n*DAY_MS);
test('Premium com mais de 48h não pode renovar antecipadamente',()=>{
 const s=subscriptionNotice({paidUntil:after(4)},now);
 assert.equal(s.status,'active');assert.equal(s.renewalAllowed,false);
});
test('48h finais: aviso e renovação permitida',()=>{
 const s=subscriptionNotice({paidUntil:after(2)},now);
 assert.equal(s.status,'expiring');assert.equal(s.remainingDays,2);assert.equal(s.renewalAllowed,true);
});
test('vencimento é verificado por data, sem cron',()=>{
 const s=subscriptionNotice({paidUntil:after(-1)},now);
 assert.equal(s.status,'expired');assert.equal(s.renewalAllowed,true);
});
test('cortesia ativa protege acesso mesmo após pagamento vencer',()=>{
 const s=subscriptionNotice({paidUntil:after(-1),courtesyUntil:after(3)},now);
 assert.equal(s.status,'courtesy');
});
test('novo usuário mantém período gratuito',()=>{
 const s=subscriptionNotice({trialUntil:after(7)},now);
 assert.equal(s.status,'trial');
});
