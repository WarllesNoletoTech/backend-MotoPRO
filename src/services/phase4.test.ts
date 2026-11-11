import test from 'node:test';
import assert from 'node:assert/strict';
import {validMonth,nextMonth,monthDueDate,nextPaymentDate,daysUntil} from './recurringDates.js';
test('despesa no dia 31 é ajustada ao último dia de cada mês',()=>{
 assert.equal(monthDueDate('2026-02',31),'2026-02-28');
 assert.equal(monthDueDate('2028-02',31),'2028-02-29');
 assert.equal(monthDueDate('2026-04',30),'2026-04-30');
 assert.equal(monthDueDate('2026-11',31),'2026-11-30');
});
test('virada de ano e próxima competência são calculadas corretamente',()=>{
 assert.equal(nextMonth('2026-12'),'2027-01');
 assert.equal(nextPaymentDate(5,'2026-11','2026-11-11'),'2026-12-05');
 assert.equal(nextPaymentDate(20,'2026-11','2026-11-11'),'2026-11-20');
 assert.equal(nextPaymentDate(15,'2027-01','2026-12-30'),'2027-01-15');
 assert.equal(daysUntil('2026-12-30','2027-01-15'),16);
});
test('rejeita períodos e dias inválidos',()=>{
 assert.equal(validMonth('2026-13'),false);
 assert.equal(validMonth('2026-00'),false);
 assert.equal(validMonth('2026-11'),true);
 assert.throws(()=>monthDueDate('2026-02',0));
 assert.throws(()=>monthDueDate('2026-02',32));
});
