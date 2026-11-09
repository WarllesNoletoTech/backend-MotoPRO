import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {makePixOrderPayload} from './pixOrderPayload.js';
describe('Pix Orders API',()=>{
 it('envia item, preço, quantidade e identificação sem alterar a cobrança de R$ 9,99',()=>{
  const payload=makePixOrderPayload('abc123',999,'teste@example.com','João da Silva');
  assert.equal(payload.total_amount,'9.99');
  assert.equal(payload.items[0].unit_price,'9.99');
  assert.equal(payload.transactions.payments[0].amount,'9.99');
  assert.equal(payload.items[0].quantity,1);
  assert.equal(payload.payer.first_name,'João');
  assert.equal(payload.payer.last_name,'da Silva');
  assert.equal(payload.payer.email,'teste@example.com');
  assert.equal(payload.transactions.payments[0].payment_method.id,'pix');
 });
 it('preserva nomes compostos cadastrados separadamente',()=>{
  const payload=makePixOrderPayload('abc123',999,'teste@example.com','Maria Clara da Silva','Maria Clara','da Silva');
  assert.equal(payload.payer.first_name,'Maria Clara');
  assert.equal(payload.payer.last_name,'da Silva');
 });
 it('respeita outros preços semanais definidos pelo admin',()=>{
  const payload=makePixOrderPayload('abc123',1299,'teste@example.com','Maria Silva');
  assert.equal(payload.total_amount,'12.99');
  assert.equal(payload.items[0].unit_price,'12.99');
 });
 it('não gera Pix sem sobrenome',()=>assert.throws(()=>makePixOrderPayload('abc',999,'teste@example.com','Maria')));
});
