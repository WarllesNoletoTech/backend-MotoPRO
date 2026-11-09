import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCreditPayerEmail} from './creditTestPayer.js';

test('usa e-mail normal fora do teste',()=>{
 assert.equal(resolveCreditPayerEmail({email:'driver@example.com',role:'driver'},{}),'driver@example.com');
});
test('permite comprador Mercado Pago de teste apenas no admin',()=>{
 assert.equal(resolveCreditPayerEmail({email:'admin@example.com',role:'admin'},{testMode:'true',testPayerEmail:'Buyer_123@TestUser.com',enforcePremium:'false'}),'buyer_123@testuser.com');
});
test('bloqueia override no modo de cobranca real',()=>{
 assert.throws(()=>resolveCreditPayerEmail({email:'admin@example.com',role:'admin'},{testPayerEmail:'buyer@testuser.com'}),/Remova MP_CREDIT_TEST_PAYER_EMAIL/);
});
test('bloqueia compra de teste para motoboys',()=>{
 assert.throws(()=>resolveCreditPayerEmail({email:'driver@example.com',role:'driver'},{testMode:'true',testPayerEmail:'buyer@testuser.com'}),/reservado ao administrador/);
});
test('bloqueia modo de teste com Premium cobrado',()=>{
 assert.throws(()=>resolveCreditPayerEmail({email:'admin@example.com',role:'admin'},{testMode:'true',testPayerEmail:'buyer@testuser.com',enforcePremium:'true'}),/Desative MP_ENFORCE_PREMIUM/);
});
test('bloqueia e-mail que nao pertence a um usuario de teste',()=>{
 assert.throws(()=>resolveCreditPayerEmail({email:'admin@example.com',role:'admin'},{testMode:'true',testPayerEmail:'real@gmail.com'}),/@testuser.com/);
});
