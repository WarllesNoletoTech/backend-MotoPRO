import {Router} from 'express';
import mongoose from 'mongoose';
import {z} from 'zod';
import {User} from '../models/User.js';
import {Entry} from '../models/Entry.js';
import {Goal} from '../models/Goal.js';
import {Motorcycle} from '../models/Motorcycle.js';
import {Maintenance} from '../models/Maintenance.js';
import {IntegrationConnection} from '../models/IntegrationConnection.js';
import {CourtesyGrant} from '../models/CourtesyGrant.js';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {BillingPayment} from '../models/BillingPayment.js';
import {AdminAudit} from '../models/AdminAudit.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';

export const adminInsightsRouter=Router();
// Montado APÓS o middleware admin, em /api/admin/billing. Não expor sem ele.
const objectId=(s:string)=>{
 if(!mongoose.isValidObjectId(s))throw new HttpError(400,'ID inválido');
 return new mongoose.Types.ObjectId(s);
};
const pagination=(q:Record<string,unknown>)=>({
 page:Math.max(1,Math.min(1000,Number.parseInt(String(q.page||1),10)||1)),
 limit:Math.max(1,Math.min(50,Number.parseInt(String(q.limit||15),10)||15))
});

adminInsightsRouter.get('/users/:id/insights',asyncRoute(async(req,res)=>{
 const targetId=objectId(req.params.id);
 const target=await User.findOne({_id:targetId,role:'driver'})
  .select('name email phone createdAt lastLoginAt lastActivityAt blockedAt').lean();
 if(!target)throw new HttpError(404,'Motoboy não encontrado');
 const [entryCount,breakdown,recent,motorcycle,maintenanceCount,pendingMaintenance,goal,integration,subscription,courtesy]=await Promise.all([
  Entry.countDocuments({userId:targetId}),
  Entry.aggregate<{_id:{type:string;category:string};count:number;totalCents:number}>([
   {$match:{userId:targetId}},
   {$group:{_id:{type:'$type',category:'$category'},count:{$sum:1},totalCents:{$sum:'$amountCents'}}},
   {$sort:{'_id.type':1,'_id.category':1}}
  ]),
  Entry.find({userId:targetId}).sort({occurredOn:-1,createdAt:-1}).limit(8)
   .select('type category amountCents occurredOn source description').lean(),
  Motorcycle.findOne({userId:targetId}).select('model year odometerKm kmPerLiter').lean(),
  Maintenance.countDocuments({userId:targetId}),
  Maintenance.countDocuments({userId:targetId,done:false}),
  Goal.findOne({userId:targetId}).select('weeklyTargetCents monthlyTargetCents').lean(),
  IntegrationConnection.findOne({userId:targetId,provider:'rappidex'})
   .select('provider remoteName lastSyncAt createdAt').lean(),
  BillingSubscription.findOne({userId:targetId}).select('status method activeUntil').lean(),
  CourtesyGrant.findOne({userId:targetId}).select('activeUntil lastGrantedAt reason').lean()
 ]);
 // O acesso individual é sempre auditado e não retorna credenciais, tokens nem dados bancários.
 await AdminAudit.create({actorId:objectId(uid(req)),action:'driver.insights.view',targetId,
  metadata:{entries:entryCount}});
 res.setHeader('Cache-Control','private, no-store');
 res.json({user:{id:String(target._id),name:target.name,email:target.email,phone:target.phone,
  createdAt:target.createdAt,lastLoginAt:target.lastLoginAt,lastActivityAt:target.lastActivityAt,blocked:!!target.blockedAt},
  entryCount,breakdown:breakdown.map(x=>({type:x._id.type,category:x._id.category,count:x.count,totalCents:x.totalCents})),
  recent:recent.map(x=>({id:String(x._id),type:x.type,category:x.category,amountCents:x.amountCents,
   occurredOn:x.occurredOn,source:x.source,description:x.description})),
  motorcycle:motorcycle?{model:motorcycle.model,year:motorcycle.year,odometerKm:motorcycle.odometerKm,kmPerLiter:motorcycle.kmPerLiter}:null,
  maintenanceCount,pendingMaintenance,
  goal:goal?{weeklyTargetCents:goal.weeklyTargetCents||0,monthlyTargetCents:goal.monthlyTargetCents||0}:null,
  integration:integration?{provider:integration.provider,remoteName:integration.remoteName,lastSyncAt:integration.lastSyncAt}:null,
  subscription:subscription?{status:subscription.status,method:subscription.method,activeUntil:subscription.activeUntil}:null,
  courtesy:courtesy?{activeUntil:courtesy.activeUntil,lastGrantedAt:courtesy.lastGrantedAt,reason:courtesy.reason}:null
 });
}));

adminInsightsRouter.get('/courtesies',asyncRoute(async(req,res)=>{
 const {page,limit}=pagination(req.query);
 const status=z.enum(['all','active','expired']).parse(req.query.status||'all');
 const now=new Date(),filter:Record<string,unknown>={};
 if(status==='active')filter.activeUntil={$gt:now};
 if(status==='expired')filter.activeUntil={$lte:now};
 const [total,grants]=await Promise.all([
  CourtesyGrant.countDocuments(filter),
  CourtesyGrant.find(filter).sort({lastGrantedAt:-1}).skip((page-1)*limit).limit(limit).lean()
 ]);
 const users=await User.find({_id:{$in:grants.map(g=>g.userId)}}).select('name email phone').lean();
 const byId=new Map(users.map(u=>[String(u._id),u]));
 res.setHeader('Cache-Control','private, no-store');
 res.json({page,limit,total,items:grants.map(g=>{
  const u=byId.get(String(g.userId));
  return {id:String(g._id),userId:String(g.userId),name:u?.name||'Conta indisponível',
   email:u?.email||'',phone:u?.phone||null,reason:g.reason,
   grantedAt:g.lastGrantedAt,activeUntil:g.activeUntil,status:g.activeUntil>now?'active':'expired'};
 })});
}));

adminInsightsRouter.get('/system',asyncRoute(async(_req,res)=>{
 const now=new Date(),day=new Date(now.getTime()-86400_000),week=new Date(now.getTime()-7*86400_000);
 const [active24h,active7d,registered7d,entries7d,registeredTotal,entriesTotal,approved7d,recentUsers]=await Promise.all([
  User.countDocuments({role:'driver',lastActivityAt:{$gte:day}}),
  User.countDocuments({role:'driver',lastActivityAt:{$gte:week}}),
  User.countDocuments({role:'driver',createdAt:{$gte:week}}),
  Entry.countDocuments({createdAt:{$gte:week}}),
  User.countDocuments({role:'driver'}),
  Entry.countDocuments({}),
  BillingPayment.aggregate<{_id:null;amountCents:number;count:number}>([
   {$match:{status:'approved',paidAt:{$gte:week}}},{$group:{_id:null,amountCents:{$sum:'$amountCents'},count:{$sum:1}}}
  ]),
  User.find({role:'driver'}).sort({createdAt:-1}).limit(5).select('name createdAt lastActivityAt').lean()
 ]);
 res.setHeader('Cache-Control','private, no-store');
 res.json({checkedAt:now,apiOnline:true,databaseConnected:mongoose.connection.readyState===1,
  uptimeSeconds:Math.floor(process.uptime()),registeredTotal,registered7d,
  active24h,active7d,entries7d,entriesTotal,
  approvedPayments7d:approved7d[0]?.count||0,approvedCents7d:approved7d[0]?.amountCents||0,
  recentUsers:recentUsers.map(u=>({id:String(u._id),name:u.name,createdAt:u.createdAt,lastActivityAt:u.lastActivityAt||null})),
  note:'Atividade de usuários autenticados. Não corresponde a visualizações anônimas nem substitui monitoramento externo da Vercel/Heroku.'});
}));
