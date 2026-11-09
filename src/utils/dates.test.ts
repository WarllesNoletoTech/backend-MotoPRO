import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {addDays,isValidDateOnly,weekRangeTuesday} from './dates.js';
test('semana de terça a segunda',()=>{
  assert.deepEqual(weekRangeTuesday('2026-11-09'),{from:'2026-11-03',to:'2026-11-09'});
  assert.deepEqual(weekRangeTuesday('2026-11-10'),{from:'2026-11-10',to:'2026-11-16'});
});
test('datas consistentes',()=>{
  assert.equal(isValidDateOnly('2026-02-30'),false);
  assert.equal(isValidDateOnly('2026-11-09'),true);
  assert.equal(addDays('2026-12-31',1),'2027-01-01');
});
