import {Router} from 'express';
import mongoose from 'mongoose';
import {z} from 'zod';
import {BillingPayment} from '../models/BillingPayment.js';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {CourtesyGrant} from '../models/CourtesyGrant.js';
import {RewardCampaign} from '../models/RewardCampaign.js';
import {ReferralReward} from '../models/ReferralReward.js';
import {AdminAudit} from '../models/AdminAudit.js';
import {AdminSetting,getAdminSettings} from '../models/AdminSetting.js';
import {User} from '../models/User.js';
import {Entry} from '../models/Entry.js';
import {adminInsightsRouter} from './adminInsights.js';
import {adminOperationsRouter} from './adminOperations.js';
import {adminNotificationsRouter} from './adminNotifications.js';
import {adminPrivacyRouter} from './privacyRequests.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {pixPaymentConfig} from '../services/mercadoPago.js';
import {REMINDER_WINDOW_MS} from '../utils/subscriptionLifecycle.js';
import {currentTrialUntil} from '../services/premiumPolicy.js';

export const adminBillingRouter=Router();
adminBillingRouter.use(asyncRoute(async(req,_res,next)=>{
 const user=await User.findById(uid(req)).select('role email blockedAt');
 if(user?.role!=='admin'||user.blockedAt)throw new HttpError(403,'Acesso restrito à administração');
 const configured=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
 if(configured && user.email!==configured)throw new HttpError(403,'Administrador diferente do autorizado');
 next();
}));
const getId=(id:string)=>{
 if(!mongoose.isValidObjectId(id))throw new HttpError(400,'Identificador inválido');
 return new mongoose.Types.ObjectId(id);
};
const pageParams=(q:Record<string,unknown>)=>({
 page:Math.max(1,Math.min(100000,Number.parseInt(String(q.page??1),10)||1)),
 limit:Math.max(1,Math.min(50,Number.parseInt(String(q.limit??20),10)||20))
});
const audit=async(actorId:string,action:string,targetId?:mongoose.Types.ObjectId,metadata:Record<string,string|number|boolean|null>={})=>{
 await AdminAudit.create({actorId:getId(actorId),action,targetId,metadata});
};
const publicUser=(u:any,trialDays:number)=>({id:String(u._id),name:u.name,email:u.email,phone:u.phone||null,role:u.role,
 blocked:!!u.blockedAt,blockReason:u.blockReason||'',createdAt:u.createdAt,lastLoginAt:u.lastLoginAt??null,lastActivityAt:u.lastActivityAt??null,
 trialEndsAt:currentTrialUntil(u.createdAt,trialDays)});
const escapeRegex=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

adminBillingRouter.get('/overview',asyncRoute(async(_req,res)=>{
 const now=new Date();
 // Corrige registros antigos mesmo sem acesso recente do motoboy.
 await BillingSubscription.updateMany({status:'active',activeUntil:{$lte:now}},{$set:{status:'expired'}});
 const lastDay=new Date(now.getTime()-24*3600_000),lastWeek=new Date(now.getTime()-7*86400_000);
 const [users,blocked,active,expiring,expired,activeCourtesy,approved,settings,active24h,new7d,entries7d]=await Promise.all([
  User.countDocuments({role:'driver'}),User.countDocuments({role:'driver',blockedAt:{$ne:null}}),
  BillingSubscription.countDocuments({status:'active',activeUntil:{$gt:now}}),
  BillingSubscription.countDocuments({status:'active',activeUntil:{$gt:now,$lte:new Date(now.getTime()+REMINDER_WINDOW_MS)}}),
  BillingSubscription.countDocuments({status:'expired'}),
  CourtesyGrant.countDocuments({activeUntil:{$gt:now}}),
  BillingPayment.aggregate<{_id:null;sum:number;count:number}>([{$match:{status:'approved'}},{$group:{_id:null,sum:{$sum:'$amountCents'},count:{$sum:1}}}]),
  getAdminSettings(),
  User.countDocuments({role:'driver',lastActivityAt:{$gte:lastDay}}),
  User.countDocuments({role:'driver',createdAt:{$gte:lastWeek}}),
  Entry.countDocuments({createdAt:{$gte:lastWeek}})
 ]);
 res.json({users,active24h,new7d,entries7d,blockedUsers:blocked,activeSubscribers:active,expiringSubscribers:expiring,expiredSubscribers:expired,activeCourtesy,
  receivedCents:approved[0]?.sum||0,approvedPayments:approved[0]?.count||0,
  weeklyPriceCents:settings.weeklyPriceCents,trialDays:settings.trialDays,premiumRequired:settings.premiumRequired,
  billingEnabled:pixPaymentConfig().enabled,
  monthlyCampaign:{status:'planning',message:'Campanhas não aleatórias, com critérios objetivos e regulamento aprovado. Sorteios não são executados pelo MotoPRO.'}});
}));

adminBillingRouter.get('/users',asyncRoute(async(req,res)=>{
 const {page,limit}=pageParams(req.query);
 const query=z.object({search:z.string().trim().max(100).optional(),filter:z.enum(['all','active','blocked']).optional()}).parse(req.query);
 const filter:any={role:'driver'};
 if(query.filter==='blocked')filter.blockedAt={$ne:null};
 if(query.filter==='active')filter.blockedAt=null;
 if(query.search)filter.$or=[{name:{$regex:escapeRegex(query.search),$options:'i'}},{email:{$regex:escapeRegex(query.search),$options:'i'}}];
 const [count,users,settings]=await Promise.all([User.countDocuments(filter),User.find(filter)
  .select('name email phone role blockedAt blockReason trialEndsAt lastLoginAt lastActivityAt createdAt')
  .sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),getAdminSettings()]);
 const ids=users.map(u=>u._id);
 const [subscriptions,courtesies]=await Promise.all([
  BillingSubscription.find({userId:{$in:ids}}).select('userId status method activeUntil cancelAtPeriodEnd').lean(),
  CourtesyGrant.find({userId:{$in:ids}}).select('userId activeUntil').lean()]);
 res.json({page,limit,total:count,items:users.map(u=>({
  ...publicUser(u,settings.trialDays),subscription:subscriptions.find(s=>String(s.userId)===String(u._id))||null,
  courtesyUntil:courtesies.find(c=>String(c.userId)===String(u._id))?.activeUntil??null
 }))});
}));
const blockInput=z.object({blocked:z.boolean(),reason:z.string().trim().min(5).max(240)});
adminBillingRouter.patch('/users/:id/access',asyncRoute(async(req,res)=>{
 const targetId=getId(req.params.id),data=blockInput.parse(req.body);
 const user=await User.findOne({_id:targetId,role:'driver'});
 if(!user)throw new HttpError(404,'Entregador não encontrado');
 user.set('blockedAt',data.blocked?new Date():null);
 user.set('blockReason',data.blocked?data.reason:'');await user.save();
 await audit(uid(req),data.blocked?'driver.block':'driver.unblock',targetId,{reason:data.reason});
 res.json({ok:true,blocked:data.blocked});
}));

adminBillingRouter.get('/subscriptions',asyncRoute(async(req,res)=>{
 const {page,limit}=pageParams(req.query);
 const status=z.enum(['all','pending','active','expiring','expired','canceled']).parse(req.query.status||'all');
 const now=new Date();
 await BillingSubscription.updateMany({status:'active',activeUntil:{$lte:now}},{$set:{status:'expired'}});
 const filter:any={};
 if(status==='expiring'){filter.status='active';filter.activeUntil={$gt:now,$lte:new Date(now.getTime()+REMINDER_WINDOW_MS)};}
 else if(status==='active'){filter.status='active';filter.activeUntil={$gt:now};}
 else if(status!=='all')filter.status=status;
 const [total,items]=await Promise.all([BillingSubscription.countDocuments(filter),
  BillingSubscription.find(filter).sort({updatedAt:-1}).skip((page-1)*limit).limit(limit).lean()]);
 const ids=items.map(s=>s.userId);
 const users=await User.find({_id:{$in:ids}}).select('name email').lean();
 res.json({page,limit,total,items:items.map(s=>({id:String(s._id),userId:String(s.userId),
  name:users.find(u=>String(u._id)===String(s.userId))?.name||'Conta indisponível',
  email:users.find(u=>String(u._id)===String(s.userId))?.email||'',
  method:s.method,status:s.status==='active' && s.activeUntil && new Date(s.activeUntil)<=new Date(now.getTime()+REMINDER_WINDOW_MS)?'expiring':s.status,
  activeUntil:s.activeUntil||null,cancelAtPeriodEnd:s.cancelAtPeriodEnd||false,
  priceCents:s.priceCents||999
 }))});
}));
const courtesyInput=z.object({days:z.number().int().min(1).max(30),reason:z.string().trim().min(5).max(240)});
adminBillingRouter.post('/users/:id/courtesy',asyncRoute(async(req,res)=>{
 const targetId=getId(req.params.id),data=courtesyInput.parse(req.body);
 const user=await User.findOne({_id:targetId,role:'driver'});
 if(!user)throw new HttpError(404,'Entregador não encontrado');
 const now=new Date();const current=await CourtesyGrant.findOne({userId:targetId});
 const from=Math.max(now.getTime(),current?.activeUntil?.getTime()||0);
 const until=new Date(from+data.days*86400_000);
 await CourtesyGrant.findOneAndUpdate({userId:targetId},{$set:{activeUntil:until,lastGrantedAt:now,lastGrantedBy:getId(uid(req)),reason:data.reason}},{upsert:true,new:true,runValidators:true});
 await audit(uid(req),'courtesy.grant',targetId,{days:data.days,reason:data.reason});
 res.json({ok:true,activeUntil:until});
}));

adminBillingRouter.get('/payments',asyncRoute(async(req,res)=>{
 const {page,limit}=pageParams(req.query);
 const query=z.object({method:z.enum(['all','pix','credit']).optional(),status:z.enum(['all','pending','approved','refunded','rejected','canceled']).optional(),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).parse(req.query);
 const filter:any={};
 if(query.method && query.method!=='all')filter.method=query.method;
 if(query.status && query.status!=='all')filter.status=query.status;
 if(query.from||query.to){filter.createdAt={};if(query.from)filter.createdAt.$gte=new Date(query.from+'T00:00:00.000Z');if(query.to)filter.createdAt.$lte=new Date(query.to+'T23:59:59.999Z');}
 const [total,items,approved]=await Promise.all([
  BillingPayment.countDocuments(filter),
  BillingPayment.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).select('-pixCode -pixQrBase64 -pixTicketUrl -idempotencyKey').lean(),
  BillingPayment.aggregate<{_id:null;sum:number;count:number}>([{$match:{...filter,status:'approved'}},{$group:{_id:null,sum:{$sum:'$amountCents'},count:{$sum:1}}}])
 ]);
 const users=await User.find({_id:{$in:items.map(x=>x.userId)}}).select('name email').lean();
 res.json({page,limit,total,approvedCents:approved[0]?.sum||0,approvedCount:approved[0]?.count||0,items:items.map(x=>({
  id:String(x._id),userId:String(x.userId),name:users.find(u=>String(u._id)===String(x.userId))?.name||'Usuário indisponível',
  method:x.method,status:x.status,amountCents:x.amountCents,providerPaymentId:x.providerPaymentId||'',
  createdAt:x.createdAt,paidAt:x.paidAt||null
 }))});
}));


// O prêmio é um crédito a repassar manualmente, não um desconto na assinatura.
adminBillingRouter.get('/referrals',asyncRoute(async(req,res)=>{
 const {page,limit}=pageParams(req.query);
 const status=z.enum(['all','available','paid','reversed']).parse(req.query.status||'all');
 const filter=status==='all'?{}:{status};
 const [total,items,totals]=await Promise.all([
  ReferralReward.countDocuments(filter),
  ReferralReward.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),
  ReferralReward.aggregate<{_id:string;sum:number;count:number}>([{$group:{_id:'$status',sum:{$sum:'$amountCents'},count:{$sum:1}}}])
 ]);
 const ids=[...new Set(items.flatMap(r=>[String(r.referrerId),String(r.referredUserId)]))];
 const users=await User.find({_id:{$in:ids}}).select('name email phone').lean();
 const userById=new Map(users.map(u=>[String(u._id),u]));
 res.setHeader('Cache-Control','private, no-store');
 res.json({page,limit,total,
  availableCents:totals.find(x=>x._id==='available')?.sum||0,
  paidCents:totals.find(x=>x._id==='paid')?.sum||0,
  reversedCents:totals.find(x=>x._id==='reversed')?.sum||0,
  items:items.map(r=>({id:String(r._id),referrerId:String(r.referrerId),
   referrerName:userById.get(String(r.referrerId))?.name||'Conta indisponível',
   referrerPhone:userById.get(String(r.referrerId))?.phone||null,
   referredName:userById.get(String(r.referredUserId))?.name||'Conta indisponível',
   amountCents:r.amountCents,status:r.status,createdAt:r.createdAt,
   paidAt:r.paidAt||null,payoutNote:r.payoutNote||''}))});
}));

// Esta ação NÃO transfere dinheiro; confirma que o administrador pagou fora do MotoPRO.
adminBillingRouter.post('/referrals/:id/mark-paid',asyncRoute(async(req,res)=>{
 const rewardId=getId(req.params.id);
 const data=z.object({note:z.string().trim().min(4).max(240)}).strict().parse(req.body);
 const result=await ReferralReward.findOneAndUpdate({_id:rewardId,status:'available'},
  {$set:{status:'paid',paidAt:new Date(),paidBy:getId(uid(req)),payoutNote:data.note}},
  {new:true,runValidators:true});
 if(!result)throw new HttpError(409,'Bônus já pago, estornado ou não encontrado. Atualize a lista.');
 await audit(uid(req),'referral.mark_paid',result.referrerId,{rewardId:String(result._id),amountCents:result.amountCents,note:data.note});
 res.json({ok:true});
}));

adminBillingRouter.get('/settings',asyncRoute(async(_req,res)=>{
 res.json({settings:await getAdminSettings(),billingEnabled:pixPaymentConfig().enabled});
}));
const settingsInput=z.object({weeklyPriceCents:z.number().int().min(199).max(99900),trialDays:z.number().int().min(0).max(30),
 // Opcional para compatibilidade com frontends antigos durante a publicação.
 premiumRequired:z.boolean().optional(),
 newRegistrationsOpen:z.boolean(),announcement:z.string().trim().max(500),maintenanceNotice:z.string().trim().max(500),
 premiumBenefits:z.array(z.string().trim().min(2).max(90)).max(10)}).strict();
adminBillingRouter.patch('/settings',asyncRoute(async(req,res)=>{
 const data=settingsInput.parse(req.body);const previous=await getAdminSettings();
 // Reabilitar cobrança é obrigatório; até um frontend antigo enviando false não pode desproteger todos.
 await AdminSetting.findOneAndUpdate({key:'global'},{$set:{...data,premiumRequired:true},$setOnInsert:{key:'global'}},{upsert:true,new:true,runValidators:true});
 await audit(uid(req),'settings.update',undefined,{previousPrice:previous.weeklyPriceCents,newPrice:data.weeklyPriceCents,trialDays:data.trialDays,premiumRequired:true,registrations:data.newRegistrationsOpen});
 res.json({settings:await getAdminSettings(),warning:'Dias gratuitos valem desde a criação da conta e são recalculados imediatamente. Pix pagos e cortesias individuais não são alterados.'});
}));

const campaignCreate=z.object({title:z.string().trim().min(4).max(100),description:z.string().trim().min(10).max(1200),
 reward:z.string().trim().min(3).max(250),objectiveCriteria:z.string().trim().min(10).max(650),
 startsAt:z.string().datetime().optional(),endsAt:z.string().datetime().optional(),approvedTermsReference:z.string().trim().max(250).optional(),
 resultSummary:z.string().trim().max(500).optional()});
adminBillingRouter.get('/campaigns',asyncRoute(async(_req,res)=>{
 const docs=await RewardCampaign.find().sort({createdAt:-1}).limit(100).lean();
 res.json({items:docs.map(x=>({...x,id:String(x._id)}))});
}));
adminBillingRouter.post('/campaigns',asyncRoute(async(req,res)=>{
 const data=campaignCreate.parse(req.body);
 if(data.startsAt&&data.endsAt&&new Date(data.endsAt)<=new Date(data.startsAt))throw new HttpError(400,'Fim deve ser posterior ao início');
 const campaign=await RewardCampaign.create({...data,createdBy:getId(uid(req)),status:'draft'});
 await audit(uid(req),'campaign.create',undefined,{campaignId:String(campaign._id)});
 res.status(201).json({id:String(campaign._id),status:'draft'});
}));
adminBillingRouter.patch('/campaigns/:id',asyncRoute(async(req,res)=>{
 const data=campaignCreate.partial().extend({status:z.enum(['draft','published','closed']).optional()}).parse(req.body);
 const doc=await RewardCampaign.findById(getId(req.params.id));if(!doc)throw new HttpError(404,'Campanha não encontrada');
 if(data.status==='published' && (!((data.approvedTermsReference??doc.approvedTermsReference)||'').trim() || !((data.objectiveCriteria??doc.objectiveCriteria)||'').trim()))
  throw new HttpError(409,'Para divulgar, informe referência de aprovação do regulamento e critérios objetivos. Sorteios não são executados neste módulo.');
 if(data.status==='published' && /sorteio|aleat[oó]ri|rifa|loteria/i.test([data.objectiveCriteria??doc.objectiveCriteria,data.description??doc.description,data.title??doc.title].join(' ')))
  throw new HttpError(409,'Campanhas aleatórias não são habilitadas por este módulo');
 Object.assign(doc,data);await doc.save();
 await audit(uid(req),'campaign.update',undefined,{campaignId:String(doc._id),status:doc.status});
 res.json({ok:true,id:String(doc._id),status:doc.status});
}));
adminBillingRouter.get('/audit',asyncRoute(async(_req,res)=>{
 const items=await AdminAudit.find().sort({createdAt:-1}).limit(60).select('action targetId metadata createdAt').lean();
 res.json({items});
}));

// Insights herda a autorização e a identidade do administrador.
adminBillingRouter.use(adminInsightsRouter);
adminBillingRouter.use(adminOperationsRouter);
adminBillingRouter.use(adminNotificationsRouter);
adminBillingRouter.use(adminPrivacyRouter);
