import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.ts',import.meta.url),'utf8');
for(const route of ['/api/dashboard','/api/entries','/api/moto','/api/goals','/api/assistant','/api/campaigns','/api/integrations']){
 test(`${route} exige auth + Premium no backend`,()=>{
  const line=source.split('\n').find(x=>x.includes(`'${route}'`));
  assert.ok(line,`Rota ausente: ${route}`);
  assert.match(line, /requireAuth,requirePremium/);
 });
}
for(const route of ['/api/billing','/api/account']){
 test(`${route} continua acessível para pagar ou exportar seus dados`,()=>{
  const line=source.split('\n').find(x=>x.includes(`'${route}'`));
  assert.ok(line); assert.match(line,/requireAuth/);assert.doesNotMatch(line,/requirePremium/);
 });
}
