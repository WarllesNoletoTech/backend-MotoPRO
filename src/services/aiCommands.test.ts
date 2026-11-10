import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAICommand,type AICommand} from './aiCommands.js';
const entry=(type:'income'|'expense',category:AICommand['category'],amountCents:number):AICommand=>({kind:'entry',type,category,amountCents,period:null,message:null});
test('IA aceita lançamentos com valores corretos',()=>{
 for(const [text,raw,amount] of [
  ['Abasteci trinta e cinco reais',entry('expense','fuel',3500),3500],
  ['Coloquei cinquenta de gasolina',entry('expense','fuel',5000),5000],
  ['Fiz cento e vinte de corrida',entry('income','delivery',12000),12000],
  ['Abasteci 8 litros e paguei 40',entry('expense','fuel',4000),4000],
 ] as const){
  const result=validateAICommand(raw,text);
  assert.equal(result.kind,'entry',text);
  if(result.kind==='entry')assert.equal(result.amountCents,amount,text);
 }
});
test('IA nunca grava valor inventado, quantidade física ou tipo invertido',()=>{
 for(const [text,raw] of [
  ['Abasteci 35 reais',entry('expense','fuel',7000)],
  ['Ganhei 5 entregas',entry('income','delivery',500)],
  ['Rodei 30 km',entry('expense','fuel',3000)],
  ['Paguei 35 reais',entry('income','delivery',3500)],
  ['Ganhei 35 reais',entry('expense','other',3500)],
  ['Paguei 30 e recebi 50',entry('income','delivery',5000)]
 ] as const){assert.equal(validateAICommand(raw,text).kind,'unknown',text);}
});
test('IA consulta período sem inventar saldos',()=>{
 assert.deepEqual(validateAICommand({kind:'summary',type:null,category:null,amountCents:null,period:'today',message:null},'Quanto ganhei hoje?'),{kind:'summary',period:'today'});
});
