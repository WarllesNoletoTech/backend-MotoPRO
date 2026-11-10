import {randomBytes} from 'node:crypto';
import mongoose from 'mongoose';
import {User} from '../models/User.js';
import {BillingPayment} from '../models/BillingPayment.js';
import {ReferralReward} from '../models/ReferralReward.js';

export const REFERRAL_BONUS_CENTS=500;
export const makeReferralCode=()=>randomBytes(6).toString('hex').toUpperCase();

// Contas antigas recebem código apenas na primeira abertura da tela.
export async function ensureReferralCode(userId:string){
 const owner=await User.findOne({_id:userId,role:'driver'}).select('referralCode');
 if(!owner)return null;
 if(owner.referralCode)return owner.referralCode as string;
 for(let attempt=0;attempt<5;attempt++){
  try{
   const updated=await User.findOneAndUpdate({_id:userId,role:'driver',$or:[{referralCode:null},{referralCode:{$exists:false}}]},
    {$set:{referralCode:makeReferralCode()}},{new:true}).select('referralCode');
   if(updated?.referralCode)return updated.referralCode as string;
   const current=await User.findById(userId).select('referralCode');
   if(current?.referralCode)return current.referralCode as string;
  }catch(error){
   if(!(typeof error==='object'&&error!==null&&'code' in error&&error.code===11000))throw error;
  }
 }
 throw new Error('Não foi possível gerar o código de indicação');
}

// A bonificação é gerada apenas após conciliação verdadeira com o Mercado Pago.
// Índice exclusivo em referredUserId impede dois créditos para a mesma indicação,
// inclusive quando webhooks e atualizações manuais são processados em paralelo.
export async function awardReferralIfEligible(userId:mongoose.Types.ObjectId){
 const referred=await User.findById(userId).select('role referredBy phone');
 if(!referred || referred.role!=='driver' || !referred.referredBy || String(referred.referredBy)===String(userId))return;
 // Não criar novo benefício se ele já foi pago ou estornado.
 if(await ReferralReward.exists({referredUserId:userId}))return;
 const first=await BillingPayment.findOne({userId,status:'approved',amountCents:{$gt:0}})
  .sort({paidAt:1,createdAt:1}).select('_id').lean();
 if(!first)return;
 const referrer=await User.findOne({_id:referred.referredBy,role:'driver'}).select('phone');
 if(!referrer || (referrer.phone && referrer.phone===referred.phone))return;
 try{
  await ReferralReward.updateOne({referredUserId:userId},{$setOnInsert:{
   referrerId:referred.referredBy,referredUserId:userId,firstPaymentId:first._id,
   amountCents:REFERRAL_BONUS_CENTS,status:'available'
  }},{upsert:true,runValidators:true});
 }catch(error){
  if(!(typeof error==='object'&&error!==null&&'code' in error&&error.code===11000))throw error;
 }
}

// O estorno do primeiro pagamento desfaz o bônus ainda NÃO repassado.
export async function reverseReferralOnRefund(paymentId:mongoose.Types.ObjectId){
 await ReferralReward.updateOne({firstPaymentId:paymentId,status:'available'},
  {$set:{status:'reversed',reversedAt:new Date()}});
}
