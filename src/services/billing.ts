import mongoose from 'mongoose';
import {BillingPayment} from '../models/BillingPayment.js';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {MpAuthorizedPayment,MpPix,MpSubscription,mp} from './mercadoPago.js';

// Somente confirmações consultadas diretamente na API do provedor liberam acesso.
export async function applyApprovedPayment(userId:mongoose.Types.ObjectId,providerPaymentId:string,method:'pix'|'credit',until?:Date){
 const now=new Date();
 let sub=await BillingSubscription.findOne({userId});
 if(!sub){
  sub=await BillingSubscription.findOneAndUpdate({userId},{$setOnInsert:{method,status:'pending',priceCents:999,cancelAtPeriodEnd:false,appliedPaymentIds:[]}},{upsert:true,new:true});
 }
 if(!sub||sub.appliedPaymentIds.includes(providerPaymentId)||(sub.cancelAtPeriodEnd && method==='credit'))return;
 const start=Math.max(now.getTime(),sub.activeUntil?.getTime()||0);
 const newUntil=until||new Date(start+7*86400_000);
 // Operação idempotente: mesma confirmação não deve estender o acesso duas vezes.
 await BillingSubscription.updateOne({userId,appliedPaymentIds:{$ne:providerPaymentId}},
  {$addToSet:{appliedPaymentIds:providerPaymentId},$set:{status:'active',method,activeUntil:newUntil}});
}
export async function syncPixPayment(providerPaymentId:string){
 const pay=await BillingPayment.findOne({providerPaymentId,method:'pix'});
 if(!pay)return;
 const mpPayment=await mp<MpPix>('GET',`/v1/payments/${encodeURIComponent(providerPaymentId)}`);
 // Protege contra eventos de outra conta, valor ou referência.
 if(mpPayment.external_reference!==`motopro_pix_${String(pay._id)}`||Math.round(Number(mpPayment.transaction_amount)*100)!==pay.amountCents||mpPayment.payment_method_id!=='pix')return;
 if(mpPayment.status==='approved'){
  pay.status='approved';pay.paidAt=new Date();await pay.save();
  await applyApprovedPayment(pay.userId,providerPaymentId,'pix');
 }else if(['rejected','cancelled','refunded','charged_back'].includes(mpPayment.status)){
  pay.status=mpPayment.status==='refunded'?'refunded':'rejected';await pay.save();
 }
}
export async function syncCreditSubscription(providerSubscriptionId:string){
 const sub=await BillingSubscription.findOne({providerSubscriptionId,method:'credit'});
 if(!sub)return;
 const remote=await mp<MpSubscription>('GET',`/preapproval/${encodeURIComponent(providerSubscriptionId)}`);
 if(remote.id!==providerSubscriptionId)return;
 if(remote.status==='cancelled'){
  sub.cancelAtPeriodEnd=true;sub.status='canceled';await sub.save();
 }
 // A autorização de cartão sozinha NÃO comprova pagamento.
}
export async function syncCreditPayment(id:string){
 const remote=await mp<MpAuthorizedPayment>('GET',`/authorized_payments/${encodeURIComponent(id)}`);
 if(!remote.preapproval_id||remote.status!=='approved')return;
 const sub=await BillingSubscription.findOne({providerSubscriptionId:remote.preapproval_id,method:'credit'});
 if(!sub||Math.round(Number(remote.transaction_amount)*100)!==(sub.priceCents??999))return;
 const providerKey=`credit_${String(remote.id)}`;
 await BillingPayment.findOneAndUpdate({providerPaymentId:providerKey},{
  $setOnInsert:{userId:sub.userId,method:'credit',amountCents:sub.priceCents??999,providerSubscriptionId:remote.preapproval_id,idempotencyKey:providerKey},
  $set:{status:'approved',paidAt:new Date()}
 },{upsert:true,new:true,runValidators:true});
 await applyApprovedPayment(sub.userId,providerKey,'credit');
}
