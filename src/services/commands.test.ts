import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseCommand,extractAmountCents} from './commands.js';
test('interpreta receitas e despesas',()=>{
 assert.deepEqual(parseCommand('Abasteci 35 reais').kind,'entry');
 assert.equal(parseCommand('Abasteci 35 reais').kind==='entry'&&parseCommand('Abasteci 35 reais').category,'fuel');
 assert.equal(parseCommand('Ganhei R$ 120,50 hoje').kind==='entry'&&parseCommand('Ganhei R$ 120,50 hoje').amountCents,12050);
 assert.equal(extractAmountCents('Paguei 1.250,50 reais'),125050);
});
test('consulta não é lançada como receita',()=>{
 assert.equal(parseCommand('Quanto lucrei essa semana?').kind,'summary');
 assert.equal(parseCommand('Qual meu lucro hoje?').kind==='summary'&&parseCommand('Qual meu lucro hoje?').period,'today');
});
