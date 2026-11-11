import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.ts',import.meta.url),'utf8');
for(const route of ['/api/dashboard','/api/entries','/api/moto','/api/goals','/api/assistant','/api/campaigns','/api/reports','/api/receipts','/api/reconciliation','/api/particulares','/api/plataformas','/api/conquistas']){
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

test('integrações exigem autenticação e nome completo; vínculo e sync exigem Premium na sub-rota',()=>{
 const mount=source.split('\n').find(x=>x.includes("'/api/integrations'"));
 assert.ok(mount);assert.match(mount,/requireAuth,requireCompleteName/);
 const routeSource=readFileSync(new URL('../routes/integrations.ts',import.meta.url),'utf8');
 assert.match(routeSource,/post\('\/rappidex\/link',requirePremium/);
 assert.match(routeSource,/post\('\/rappidex\/sync',requirePremium/);
});
