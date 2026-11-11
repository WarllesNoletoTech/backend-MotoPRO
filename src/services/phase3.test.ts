import test from 'node:test';
import assert from 'node:assert/strict';
import {platformOf,calculateAchievements} from './phase3.js';

test('classificação prioriza origem comprovada em integrações',()=>{
 assert.equal(platformOf({source:'integration',provider:'rappidex',platform:'ifood'}),'rappidex');
 assert.equal(platformOf({source:'private',provider:'private'}),'private');
 assert.equal(platformOf({source:'manual',platform:'ifood'}),'ifood');
 assert.equal(platformOf({source:'manual',platform:'99'}),'99');
 assert.equal(platformOf({source:'manual',platform:'nada'}),'manual');
});
test('conquistas são individuais e limitam o progresso ao objetivo',()=>{
 const entries=calculateAchievements({entries:500,distinctDays:10,privatePaid:2,hasGoal:true,hasMoto:false,hasPlan:true,hasRappidex:false});
 assert.equal(entries.find(x=>x.id==='organization-25')?.progress,25);
 assert.equal(entries.find(x=>x.id==='private-10')?.unlocked,false);
 assert.equal(entries.find(x=>x.id==='days-7')?.unlocked,true);
 assert.equal(entries.find(x=>x.id==='moto-set')?.unlocked,false);
 assert.equal(entries.length,9);
});
