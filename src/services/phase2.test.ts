import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileEntries} from './reconciliation.js';
import {maintenanceStatus} from './maintenancePlanner.js';
import {receiptConfirmationSchema,verifyReceiptImage} from './receiptAI.js';

test('conciliação não apaga nem altera lançamentos e identifica coincidências 1 a 1',()=>{
 const records=[
  {id:'a',source:'integration',provider:'rappidex',amountCents:2500,occurredOn:'2026-11-10'},
  {id:'b',source:'integration',provider:'rappidex',amountCents:2500,occurredOn:'2026-11-10'},
  {id:'c',source:'manual',provider:'',amountCents:2500,occurredOn:'2026-11-10'},
  {id:'d',source:'receipt',provider:'',amountCents:1000,occurredOn:'2026-11-10'},
  {id:'e',source:'integration',provider:'rappidex',amountCents:2500,occurredOn:'2026-11-09'},
 ];
 const before=JSON.stringify(records);
 const result=reconcileEntries(records);
 assert.equal(result.importedCents,7500);
 assert.equal(result.manualCents,3500);
 assert.equal(result.possibleDuplicates.length,1);
 assert.equal(result.possibleDuplicates[0].manualId,'c');
 assert.equal(result.days.length,2);
 assert.equal(JSON.stringify(records),before);
});
test('alertas por quilometragem e calendário, sem inventar intervalo do fabricante',()=>{
 const plan={label:'Óleo',intervalKm:3000,lastServiceKm:10000,intervalDays:90,lastServiceOn:'2026-09-01'};
 const ok=maintenanceStatus(plan,12000,'2026-10-01');
 assert.equal(ok.nextKm,13000);assert.equal(ok.status,'ok');
 assert.equal(maintenanceStatus(plan,12500,'2026-10-01').status,'soon');
 assert.equal(maintenanceStatus(plan,13001,'2026-10-01').status,'due');
 assert.equal(maintenanceStatus(plan,11000,'2026-11-25').status,'soon');
 assert.equal(maintenanceStatus(plan,11000,'2026-12-01').status,'due');
 assert.equal(maintenanceStatus({...plan,enabled:false},13001,'2026-12-01').status,'paused');
});
test('scanner exige imagem real e confirmação com valores e categorias coerentes',()=>{
 const png=Buffer.from([137,80,78,71,13,10,26,10,0,0]);
 assert.doesNotThrow(()=>verifyReceiptImage(png,'image/png'));
 assert.throws(()=>verifyReceiptImage(Buffer.from('qualquer coisa'),'image/png'));
 assert.throws(()=>verifyReceiptImage(png,'image/jpeg'));
 const good={type:'expense',category:'fuel',amountCents:2590,occurredOn:'2026-11-10',description:'Gasolina'};
 assert.equal(receiptConfirmationSchema.safeParse(good).success,true);
 assert.equal(receiptConfirmationSchema.safeParse({...good,amountCents:0}).success,false);
 assert.equal(receiptConfirmationSchema.safeParse({...good,category:'bonus'}).success,false);
 assert.equal(receiptConfirmationSchema.safeParse({...good,type:'income'}).success,false);
 assert.equal(receiptConfirmationSchema.safeParse({...good,occurredOn:'2026-02-30'}).success,false);
});
