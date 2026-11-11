import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {lastClosedWeek,isReportWindowOpen,weeklyEmailText,hashToken,newVerificationToken} from './reportEmail.js';

test('semana de terça a segunda: última semana concluída',()=>{
 assert.deepEqual(lastClosedWeek('2026-11-11'),{from:'2026-11-03',to:'2026-11-09'});
 assert.deepEqual(lastClosedWeek('2026-11-10'),{from:'2026-11-03',to:'2026-11-09'});
 assert.deepEqual(lastClosedWeek('2026-11-09'),{from:'2026-10-27',to:'2026-11-02'});
 assert.deepEqual(lastClosedWeek('2027-01-01'),{from:'2026-12-22',to:'2026-12-28'});
});
test('só libera o envio após terça 8h no fuso de Belém',()=>{
 assert.equal(isReportWindowOpen(new Date('2026-11-10T10:59:00Z'),'America/Belem'),false);
 assert.equal(isReportWindowOpen(new Date('2026-11-10T11:00:00Z'),'America/Belem'),true);
 assert.equal(isReportWindowOpen(new Date('2026-11-11T11:00:00Z'),'America/Belem'),true);
 assert.equal(isReportWindowOpen(new Date('2026-11-10T11:00:00Z'),'Fuso Inválido'),false);
});
test('token de confirmação é aleatório e armazenado apenas como hash',()=>{
 const a=newVerificationToken(),b=newVerificationToken();
 assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);
 assert.equal(hashToken(a).length,64);assert.notEqual(hashToken(a),a);
});
test('resumo contém números e ressalva de registros incompletos',()=>{
 const body=weeklyEmailText({name:'Patrik de Sousa',from:'2026-11-03',to:'2026-11-09',incomeCents:120000,expenseCents:25000,profitCents:95000,entriesCount:12,integratedCount:8});
 assert.match(body,/R\$\s?1\.200,00/);assert.match(body,/R\$\s?950,00/);assert.match(body,/podem não incluir todas as despesas/);
});
