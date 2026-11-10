import {Router} from 'express';
import mongoose from 'mongoose';
import {User} from '../models/User.js';
import {ReferralReward} from '../models/ReferralReward.js';
import {uid} from '../services/auth.js';
import {ensureReferralCode,REFERRAL_BONUS_CENTS} from '../services/referrals.js';
import {asyncRoute,HttpError} from '../utils/http.js';

export const referralsRouter=Router();
referralsRouter.get('/me',asyncRoute(async(req,res)=>{
 const userId=uid(req);
 const owner=await User.findById(userId).select('role');
 if(!owner||owner.role!=='driver')throw new HttpError(403,'Indicações disponíveis para motoboys');
 const code=await ensureReferralCode(userId);
 const referrerId=new mongoose.Types.ObjectId(userId);
 const [invited,totalRewards,aggregate]=await Promise.all([
  User.find({referredBy:referrerId,role:'driver'}).sort({createdAt:-1}).limit(50).select('name createdAt').lean(),
  User.countDocuments({referredBy:referrerId,role:'driver'}),
  ReferralReward.aggregate<{_id:string;sum:number;count:number}>([
   {$match:{referrerId,status:{$in:['available','paid']}}},
   {$group:{_id:'$status',sum:{$sum:'$amountCents'},count:{$sum:1}}}
  ])
 ]);
 const rewards=await ReferralReward.find({referrerId,referredUserId:{$in:invited.map(u=>u._id)}}).lean();
 const byReferred=new Map(rewards.map(r=>[String(r.referredUserId),r]));
 const available=aggregate.find(x=>x._id==='available');
 const paid=aggregate.find(x=>x._id==='paid');
 res.setHeader('Cache-Control','private, no-store');
 res.json({code,bonusCents:REFERRAL_BONUS_CENTS,totalInvited:totalRewards,
  rewardedCount:(available?.count||0)+(paid?.count||0),
  availableCents:available?.sum||0,paidCents:paid?.sum||0,
  items:invited.map(u=>({id:String(u._id),name:u.name,createdAt:u.createdAt,
   status:byReferred.get(String(u._id))?.status||'pending',
   amountCents:byReferred.get(String(u._id))?.amountCents||0}))});
}));
