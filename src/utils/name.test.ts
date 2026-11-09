import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {nameParts,joinFullName,validNamePart} from './name.js';
describe('cadastro com nome completo',()=>{
 it('aceita nome e sobrenome com acentos',()=>{
  assert.equal(nameParts('  João   da Silva  ').complete,true);
  assert.equal(joinFullName('João','da Silva'),'João da Silva');
 });
 it('exige sobrenome para usuários antigos',()=>{
  assert.equal(nameParts('Stefani').complete,false);
  assert.equal(nameParts('Maria').complete,false);
  assert.equal(nameParts('A B').complete,false);
 });
 it('rejeita nomes vazios, iniciais, números e símbolos',()=>{
  for(const n of ['','A','1Maria','João1','Jo@o','X'])assert.equal(validNamePart(n),false);
 });
});
