import mongoose from 'mongoose';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {User} from '../models/User.js';
import {CourtesyGrant} from '../models/CourtesyGrant.js';
import {uid} from './auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';

/** Acionamento somente após homologação. Não bloqueia as funções básicas. */
export const requirePremium = asyncRoute(async(req,_res,next)=>{
  if(process.env.MP_ENFORCE_PREMIUM!=='true')return next();
  const user=await User.findById(uid(req)).select('role trialEndsAt');
  if(user?.role==='admin'||(user?.trialEndsAt && new Date(user.trialEndsAt)>new Date()))return next();
  const subscription=await BillingSubscription.findOne({userId:new mongoose.Types.ObjectId(uid(req)),activeUntil:{$gt:new Date()}});
  if(!subscription){
    const courtesy=await CourtesyGrant.exists({userId:new mongoose.Types.ObjectId(uid(req)),activeUntil:{$gt:new Date()}});
    if(courtesy)return next();
    throw new HttpError(402,'Seu período de teste terminou. Ative o MotoPRO Premium para usar o assistente.');
  }
  next();
});
