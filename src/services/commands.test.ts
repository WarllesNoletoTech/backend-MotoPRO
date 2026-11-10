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
