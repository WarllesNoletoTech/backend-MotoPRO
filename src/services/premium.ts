import mongoose from 'mongoose';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {User} from '../models/User.js';
import {CourtesyGrant} from '../models/CourtesyGrant.js';
import {subscriptionNotice} from '../utils/subscriptionLifecycle.js';
import {uid} from './auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';

/** A liberação é sempre verificada no servidor. O frontend não concede permissões. */
export const premiumEnforced = () => process.env.MP_ENFORCE_PREMIUM === 'true';
export const premiumEntitled = (status: string) => ['active','expiring','trial','courtesy'].includes(status);

export const requirePremium = asyncRoute(async(req,_res,next)=>{
  if(!premiumEnforced())return next(); // Homologação: habilitar após validar todo o fluxo.
  // A projeção é um documento único. Evita o falso tipo de lista do models.User legado.
  const user=(await User.findById(uid(req)).select('role trialEndsAt blockedAt').lean()) as
    {role:'driver'|'admin';trialEndsAt?:Date|null;blockedAt?:Date|null}|null;
  if(!user)throw new HttpError(401,'Conta não encontrada');
  if(user.blockedAt)throw new HttpError(403,'Conta bloqueada. Entre em contato com o suporte.');
  if(user.role==='admin')return next();
  const userId=new mongoose.Types.ObjectId(uid(req));
  const now=new Date();
  const [sub,courtesy]=await Promise.all([
    BillingSubscription.findOne({userId}).select('activeUntil status').lean(),
    CourtesyGrant.findOne({userId,activeUntil:{$gt:now}}).select('activeUntil').lean()
  ]);
  const notice=subscriptionNotice({paidUntil:sub?.activeUntil,trialUntil:user.trialEndsAt,courtesyUntil:courtesy?.activeUntil},now);
  if(premiumEntitled(notice.status))return next();
  if(sub?.status==='active' && sub.activeUntil && new Date(sub.activeUntil)<=now){
    await BillingSubscription.updateOne({_id:sub._id,status:'active',activeUntil:{$lte:now}},{$set:{status:'expired'}});
  }
  throw new HttpError(402,'Seu Premium venceu ou ainda não foi ativado. Renove pelo Pix em Assinatura para usar os recursos do MotoPRO.');
});
