import mongoose from 'mongoose';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {User} from '../models/User.js';
import {CourtesyGrant} from '../models/CourtesyGrant.js';
import {subscriptionNotice} from '../utils/subscriptionLifecycle.js';
import {getAdminSettings} from '../models/AdminSetting.js';
import {premiumAccessFor,currentTrialUntil} from './premiumPolicy.js';
import {uid} from './auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';

/** O painel do admin controla a exigência em tempo real, sem redeploy ou variável Heroku. */
export const requirePremium = asyncRoute(async(req,_res,next)=>{
  // A projeção é um documento único. Evita o falso tipo de lista do models.User legado.
  const user=(await User.findById(uid(req)).select('role createdAt blockedAt phone').lean()) as
    {role:'driver'|'admin';createdAt?:Date|null;blockedAt?:Date|null;phone?:string|null}|null;
  if(!user)throw new HttpError(401,'Conta não encontrada');
  if(user.blockedAt)throw new HttpError(403,'Conta bloqueada. Entre em contato com o suporte.');
  if(user.role==='admin')return next();
  if(!user.phone)throw new HttpError(428,'Complete seu cadastro informando o celular com DDD para continuar.');
  const settings=await getAdminSettings();
  const userId=new mongoose.Types.ObjectId(uid(req));
  const now=new Date();
  const [sub,courtesy]=await Promise.all([
    BillingSubscription.findOne({userId}).select('activeUntil status').lean(),
    CourtesyGrant.findOne({userId,activeUntil:{$gt:now}}).select('activeUntil').lean()
  ]);
  const notice=subscriptionNotice({paidUntil:sub?.activeUntil,trialUntil:currentTrialUntil(user.createdAt,settings.trialDays),courtesyUntil:courtesy?.activeUntil},now);
  if(premiumAccessFor(notice.status,true,false).allowed)return next();
  if(sub?.status==='active' && sub.activeUntil && new Date(sub.activeUntil)<=now){
    await BillingSubscription.updateOne({_id:sub._id,status:'active',activeUntil:{$lte:now}},{$set:{status:'expired'}});
  }
  throw new HttpError(402,'Seu Premium venceu ou ainda não foi ativado. Renove pelo Pix em Assinatura para usar os recursos do MotoPRO.');
});
