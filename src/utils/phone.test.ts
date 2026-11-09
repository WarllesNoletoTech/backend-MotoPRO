import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeBrazilMobilePhone} from './phone.js';
for (const [raw,expected] of [
 ['(94) 99999-1234','+5594999991234'],
 ['94999991234','+5594999991234'],
 ['+55 (94) 99999-1234','+5594999991234'],
 ['(11) 91234-5678','+5511912345678'],
 ['',''],['11 1234-5678',''],['+1 (212) 555-1122',''],['0094999991234',''],
 ['(00) 99999-1234',''],['1191234567',''],['abc 94999991234',''],
 ['+55+94999991234','']
] as [string,string][]) {
 test(`normalização de telefone: ${raw||'vazio'}`,()=>assert.equal(normalizeBrazilMobilePhone(raw),expected||null));
}
