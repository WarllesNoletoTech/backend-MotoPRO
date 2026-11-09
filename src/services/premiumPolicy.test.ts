import test from 'node:test';
import assert from 'node:assert/strict';
import {premiumAccessFor,trialEndsAtFromDays,PremiumStatus} from './premiumPolicy.js';

for(const status of ['none','expired'] as PremiumStatus[]){
 test(`Motoboy sem Premium (${status}) deve ser bloqueado quando obrigatório`,()=>{
  assert.deepEqual(premiumAccessFor(status,true,false),{premiumRequired:true,allowed:false});
 });
}
for(const status of ['active','expiring','trial','courtesy'] as PremiumStatus[]){
 test(`Acesso permitido somente enquanto direito ${status} vigente`,()=>{
  assert.equal(premiumAccessFor(status,true,false).allowed,true);
 });
}
test('Administrador sempre isento',()=>{
 assert.equal(premiumAccessFor('none',true,true).allowed,true);
});
test('Admin pode desligar exigência por configuração persistida',()=>{
 assert.equal(premiumAccessFor('none',false,false).allowed,true);
});

test('Zero dias não concede acesso grátis no cadastro',()=>{
 assert.equal(trialEndsAtFromDays(0,new Date('2026-11-09T19:00:00Z')),null);
});
test('O administrador define a duração exata do teste para novos usuários',()=>{
 const now=new Date('2026-11-09T19:00:00Z');
 assert.equal(trialEndsAtFromDays(7,now)?.toISOString(),'2026-11-16T19:00:00.000Z');
});
test('Valores inválidos não concedem testes',()=>{
 assert.throws(()=>trialEndsAtFromDays(-1),RangeError);
 assert.throws(()=>trialEndsAtFromDays(31),RangeError);
});
