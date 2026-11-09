import test from 'node:test';
import assert from 'node:assert/strict';
import {premiumAccessFor,trialEndsAtFromDays,currentTrialUntil,PremiumStatus} from './premiumPolicy.js';
import {subscriptionNotice} from '../utils/subscriptionLifecycle.js';
const created=new Date('2026-11-09T19:00:00Z');
const now=new Date('2026-11-09T20:00:00Z');
for(const status of ['none','expired'] as PremiumStatus[]){
 test(`Sem Pix ou direito válido (${status}) é bloqueado mesmo com configuração legada desligada`,()=>{
  assert.deepEqual(premiumAccessFor(status,false,false),{premiumRequired:true,allowed:false});
 });
}
for(const status of ['active','expiring','trial','courtesy'] as PremiumStatus[]){
 test(`Acesso com direito válido: ${status}`,()=>assert.equal(premiumAccessFor(status,true,false).allowed,true));
}
test('Administrador é isento, independentemente da assinatura',()=>assert.equal(premiumAccessFor('none',true,true).allowed,true));
test('Zero dias bloqueia conta nova sem Pix',()=>{
 const notice=subscriptionNotice({trialUntil:currentTrialUntil(created,0)},now);
 assert.equal(notice.status,'none');assert.equal(premiumAccessFor(notice.status,true,false).allowed,false);
});
test('De 0 para 1 dia altera imediatamente o acesso da mesma conta',()=>{
 const trial=currentTrialUntil(created,1);
 assert.equal(trial?.toISOString(),'2026-11-10T19:00:00.000Z');
 assert.equal(subscriptionNotice({trialUntil:trial},now).status,'trial');
});
test('Voltar de 1 para 0 bloqueia imediatamente o mesmo cadastro',()=>{
 assert.equal(subscriptionNotice({trialUntil:currentTrialUntil(created,0)},now).status,'none');
});
test('Teste de um dia encerra na hora exata depois do cadastro',()=>{
 assert.equal(subscriptionNotice({trialUntil:currentTrialUntil(created,1)},new Date('2026-11-10T19:00:00Z')).status,'none');
});
test('Conta antiga com mais de um dia não ganha acesso ao alterar de 0 para 1',()=>{
 assert.equal(subscriptionNotice({trialUntil:currentTrialUntil(created,1)},new Date('2026-11-12T20:00:00Z')).status,'none');
});
test('Pix aprovado continua tendo precedência com dias gratuitos zero',()=>{
 const notice=subscriptionNotice({paidUntil:new Date('2026-11-16T20:00:00Z'),trialUntil:currentTrialUntil(created,0)},now);
 assert.equal(notice.status,'active');assert.equal(premiumAccessFor(notice.status,true,false).allowed,true);
});
test('Cortesia individual válida continua liberada com zero dias',()=>{
 const notice=subscriptionNotice({courtesyUntil:new Date('2026-11-11T00:00:00Z'),trialUntil:currentTrialUntil(created,0)},now);
 assert.equal(notice.status,'courtesy');
});
test('Sem data de cadastro válida não inventa teste gratuito',()=>{
 assert.equal(currentTrialUntil(null,1),null);
 assert.equal(currentTrialUntil('invalid',1),null);
});
test('Dias inválidos não geram teste',()=>{
 assert.equal(trialEndsAtFromDays(0,created),null);
 assert.throws(()=>trialEndsAtFromDays(-1),RangeError);
 assert.throws(()=>trialEndsAtFromDays(31),RangeError);
});
