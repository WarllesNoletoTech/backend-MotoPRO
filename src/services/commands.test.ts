import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseCommand,extractAmountCents} from './commands.js';
const entry = (sentence:string) => {
 const result=parseCommand(sentence);
 assert.equal(result.kind,'entry',sentence);
 if(result.kind!=='entry')throw Error(`Não interpretado: ${sentence}`);
 return result;
};
test('comandos de ganhos e despesas por voz',()=>{
 assert.equal(entry('Abasteci 35 reais').category,'fuel');
 assert.equal(entry('Abastecimento de trinta e cinco reais').amountCents,3500);
 assert.equal(entry('Coloquei cinquenta reais de gasolina').category,'fuel');
 assert.equal(entry('Abasteci 8 litros, paguei 40 reais').amountCents,4000);
 assert.equal(entry('Ganhei 120 reais em entregas hoje').amountCents,12000);
 assert.equal(entry('Recebi cento e vinte reais em corridas').amountCents,12000);
 assert.equal(entry('Ganhei R$ 120,50 hoje').amountCents,12050);
 assert.equal(entry('Gastei 30 em combustível nas entregas').type,'expense');
 assert.equal(entry('Troquei óleo e gastei 60 reais').category,'maintenance');
 assert.equal(entry('Gastei 25 reais no almoço').category,'food');
 assert.equal(extractAmountCents('Paguei 1.250,50 reais'),125050);
 assert.equal(extractAmountCents('Abasteci trinta e cinco reais'),3500);
});
test('consulta não é lançada como receita',()=>{
 assert.equal(parseCommand('Quanto lucrei essa semana?').kind,'summary');
 assert.equal(parseCommand('Qual meu lucro hoje?').kind,'summary');
 assert.equal(parseCommand('Quanto gastei hoje?').kind,'summary');
 assert.equal(parseCommand('Qual o saldo da semana?').kind,'summary');
 assert.equal(parseCommand('Ganhei 100 e gastei 50 reais').kind,'unknown');
 assert.equal(parseCommand('Fui trabalhar de moto').kind,'unknown');
});

test('milhares ditos, escritos e com centavos',()=>{
 const samples:[string,number][]=[
  ['Ganhei mil reais',100000],
  ['Ganhei 1000',100000],
  ['Recebi 1.000',100000],
  ['Ganhei 25 mil',2500000],
  ['Recebi R$ 25 mil',2500000],
  ['Faturei vinte e cinco mil reais',2500000],
  ['Ganhei mil e quinhentos',150000],
  ['Recebi 1.250,50',125050],
  ['Recebi R$ 1.250,50',125050],
  ['Ganhei 1,5 mil reais',150000],
  ['Recebi 25k',2500000],
  ['Recebi 1 milhão de reais',100000000],
  ['Recebi 2 mil e trezentos reais',230000],
  ['Paguei mil reais e cinquenta centavos',100050],
  ['Gastei cinquenta centavos',50],
  ['Recebi trinta e cinco centavos',35],
  ['Ganhei 25 mil e cinquenta centavos',2500050],
  ['Gastei 8 litros de gasolina e paguei mil',100000],
  ['Fiz 25 mil de entregas',2500000],
  ['Coloquei vinte e cinco mil de gasolina',2500000],
 ];
 for(const [phrase,cents] of samples){
  assert.equal(extractAmountCents(phrase),cents,phrase);
  assert.equal(entry(phrase).amountCents,cents,phrase);
 }
});
test('números físicos e valores sem segurança não viram dinheiro',()=>{
 for(const phrase of ['Ganhei 5 entregas','Abasteci 8 litros','Rodei 30 km','Fiz 10 corridas'])
  assert.equal(extractAmountCents(phrase),null,phrase);
});

test('consultas mensais e semanais respeitam o período',()=>{
 assert.deepEqual(parseCommand('Quanto lucrei neste mês?'),{kind:'summary',period:'month'});
 assert.deepEqual(parseCommand('Qual meu saldo mensal?'),{kind:'summary',period:'month'});
 assert.deepEqual(parseCommand('Quanto ganhei hoje?'),{kind:'summary',period:'today'});
 assert.deepEqual(parseCommand('Qual meu lucro na semana?'),{kind:'summary',period:'week'});
});
