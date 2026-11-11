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
import {AiUsage} from '../models/AiUsage.js';
import {ReceiptAnalysis} from '../models/ReceiptAnalysis.js';
import {MaintenancePlan} from '../models/MaintenancePlan.js';
import {PrivateCustomer} from '../models/PrivateCustomer.js';
import {PrivateDelivery} from '../models/PrivateDelivery.js';
import {RecurringExpense} from '../models/RecurringExpense.js';
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
 const driver=target as unknown as {_id:mongoose.Types.ObjectId;name:string;email:string;phone:string|null;
  createdAt:Date;lastLoginAt:Date|null;lastActivityAt:Date|null;blockedAt:Date|null};
 const [entryCount,breakdown,recent,motorcycle,maintenanceCount,pendingMaintenance,goal,integration,subscription,courtesy,privateCustomerCount,privateDeliveryCount]=await Promise.all([
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
  CourtesyGrant.findOne({userId:targetId}).select('activeUntil lastGrantedAt reason').lean(),
  PrivateCustomer.countDocuments({userId:targetId}),
  PrivateDelivery.countDocuments({userId:targetId})
 ]);
 // O acesso individual é sempre auditado e não retorna credenciais, tokens nem dados bancários.
 await AdminAudit.create({actorId:objectId(uid(req)),action:'driver.insights.view',targetId,
  metadata:{entries:entryCount}});
 res.setHeader('Cache-Control','private, no-store');
 const moto=motorcycle as unknown as {model:string;year?:number;odometerKm?:number;kmPerLiter?:number}|null;
 const rappidex=integration as unknown as {provider:string;remoteName:string;lastSyncAt:Date|null}|null;
 res.json({user:{id:String(driver._id),name:driver.name,email:driver.email,phone:driver.phone,
  createdAt:driver.createdAt,lastLoginAt:driver.lastLoginAt,lastActivityAt:driver.lastActivityAt,blocked:!!driver.blockedAt},
  entryCount,breakdown:breakdown.map(x=>({type:x._id.type,category:x._id.category,count:x.count,totalCents:x.totalCents})),
  recent:recent.map(x=>({id:String(x._id),type:x.type,category:x.category,amountCents:x.amountCents,
   occurredOn:x.occurredOn,source:x.source,description:x.description})),
  motorcycle:moto?{model:moto.model,year:moto.year,odometerKm:moto.odometerKm,kmPerLiter:moto.kmPerLiter}:null,
  maintenanceCount,pendingMaintenance,privateCustomerCount,privateDeliveryCount,
  goal:goal?{weeklyTargetCents:goal.weeklyTargetCents||0,monthlyTargetCents:goal.monthlyTargetCents||0}:null,
  integration:rappidex?{provider:rappidex.provider,remoteName:rappidex.remoteName,lastSyncAt:rappidex.lastSyncAt}:null,
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
 const [active24h,active7d,registered7d,entries7d,registeredTotal,entriesTotal,approved7d,recentUsers,aiCounts,aiThirty,receiptsConfirmed,activePlans,activeRecurrences,recurringEntries7d]=await Promise.all([
  User.countDocuments({role:'driver',lastActivityAt:{$gte:day}}),
  User.countDocuments({role:'driver',lastActivityAt:{$gte:week}}),
  User.countDocuments({role:'driver',createdAt:{$gte:week}}),
  Entry.countDocuments({createdAt:{$gte:week}}),
  User.countDocuments({role:'driver'}),
  Entry.countDocuments({}),
  BillingPayment.aggregate<{_id:null;amountCents:number;count:number}>([
   {$match:{status:'approved',paidAt:{$gte:week}}},{$group:{_id:null,amountCents:{$sum:'$amountCents'},count:{$sum:1}}}
  ]),
  User.find({role:'driver'}).sort({createdAt:-1}).limit(5).select('name createdAt lastActivityAt').lean(),
  AiUsage.aggregate<{_id:{feature:string;outcome:string};count:number;inputTokens:number;outputTokens:number;estimatedUsd:number;priced:number}>([
   {$match:{createdAt:{$gte:week}}},{$group:{_id:{feature:'$feature',outcome:'$outcome'},count:{$sum:1},inputTokens:{$sum:'$inputTokens'},outputTokens:{$sum:'$outputTokens'},estimatedUsd:{$sum:{$ifNull:['$estimatedUsd',0]}},priced:{$sum:{$cond:[{$ne:['$estimatedUsd',null]},1,0]}}}}
  ]),
  AiUsage.countDocuments({createdAt:{$gte:new Date(now.getTime()-30*86400_000)}}),
  ReceiptAnalysis.countDocuments({confirmedEntryId:{$ne:null}}),
  MaintenancePlan.countDocuments({enabled:true}),
  RecurringExpense.countDocuments({enabled:true}),
  Entry.countDocuments({source:'recurring',createdAt:{$gte:week}})
 ]);
 res.setHeader('Cache-Control','private, no-store');
 res.json({checkedAt:now,apiOnline:true,databaseConnected:mongoose.connection.readyState===1,
  uptimeSeconds:Math.floor(process.uptime()),registeredTotal,registered7d,
  active24h,active7d,entries7d,entriesTotal,
  approvedPayments7d:approved7d[0]?.count||0,approvedCents7d:approved7d[0]?.amountCents||0,
  automation:{last30d:aiThirty,confirmedReceipts:receiptsConfirmed,activeMaintenancePlans:activePlans,activeRecurrences,recurringEntries7d,
   last7d:aiCounts.map(r=>({feature:r._id.feature,outcome:r._id.outcome,count:r.count,inputTokens:r.inputTokens,outputTokens:r.outputTokens,estimatedUsd:r.priced===r.count?Number(r.estimatedUsd.toFixed(6)):null}))},
  recentUsers:recentUsers.map(u=>({id:String(u._id),name:u.name,createdAt:u.createdAt,lastActivityAt:u.lastActivityAt||null})),
  note:'Atividade de usuários autenticados. Não corresponde a visualizações anônimas nem substitui monitoramento externo da Vercel/Heroku.'});
}));

// Indicadores agregados por período. Não fornece transcrições, telefones ou saldos individuais.
adminInsightsRouter.get('/analytics',asyncRoute(async(req,res)=>{
 const {days}=z.object({days:z.coerce.number().int().refine(v=>[7,30,90].includes(v)).default(30)}).parse(req.query);
 const now=new Date(),start=new Date(now.getTime()-days*86400_000),cohortStart=new Date(start.getTime()-days*86400_000);
 const [users,activeDrivers,newDrivers,previousCohort,retainedDrivers,activeSubscriptions,activeCourtesy,payments,platformStats,privateDeliveries,privateCustomers,aiSummary]=await Promise.all([
  User.countDocuments({role:'driver'}),
  User.countDocuments({role:'driver',lastActivityAt:{$gte:start}}),
  User.countDocuments({role:'driver',createdAt:{$gte:start}}),
  User.countDocuments({role:'driver',createdAt:{$gte:cohortStart,$lt:start}}),
  User.countDocuments({role:'driver',createdAt:{$gte:cohortStart,$lt:start},lastActivityAt:{$gte:start}}),
  BillingSubscription.find({status:'active',activeUntil:{$gt:now}}).select('priceCents cancelAtPeriodEnd').lean(),
  CourtesyGrant.countDocuments({activeUntil:{$gt:now}}),
  BillingPayment.aggregate<{_id:null;amountCents:number;count:number}>([
   {$match:{status:'approved',paidAt:{$gte:start,$lte:now}}},{$group:{_id:null,amountCents:{$sum:'$amountCents'},count:{$sum:1}}}
  ]),
  Entry.aggregate<{_id:{type:string;source:string;provider?:string;platform?:string};count:number;amountCents:number}>([
   {$match:{createdAt:{$gte:start,$lte:now}}},
   {$group:{_id:{type:'$type',source:'$source',provider:'$provider',platform:'$platform'},count:{$sum:1},amountCents:{$sum:'$amountCents'}}}
  ]),
  PrivateDelivery.countDocuments({createdAt:{$gte:start}}),
  PrivateCustomer.countDocuments({createdAt:{$gte:start}}),
  AiUsage.aggregate<{_id:null;calls:number;estimatedUsd:number;priced:number}>([
   {$match:{createdAt:{$gte:start}}},{$group:{_id:null,calls:{$sum:1},estimatedUsd:{$sum:{$ifNull:['$estimatedUsd',0]}},priced:{$sum:{$cond:[{$ne:['$estimatedUsd',null]},1,0]}}}}
  ])
 ]);
 const paid=payments[0];
 // Projeção para referência operacional; NÃO é receita futura contratada/garantida.
 const monthlyProjectionCents=Math.round(activeSubscriptions.reduce((sum,s)=>sum+(s.priceCents||999),0)*30/7);
 res.setHeader('Cache-Control','private, no-store');
 res.json({periodDays:days,generatedAt:now,users,activeDrivers,newDrivers,
  previousCohort,retainedDrivers,retentionPercent:previousCohort?Math.round(retainedDrivers/previousCohort*100):null,
  payingSubscribers:activeSubscriptions.length,activeCourtesy,
  cancelAtPeriodEnd:activeSubscriptions.filter(s=>s.cancelAtPeriodEnd).length,
  activeSubscriptionRatio:users?Math.round(activeSubscriptions.length/users*100):0,
  approvedPayments:paid?.count||0,approvedRevenueCents:paid?.amountCents||0,
  monthlyProjectionCents,
  privateDeliveries,privateCustomers,
  earnings:platformStats.map(s=>({type:s._id.type,source:s._id.source,provider:s._id.provider||'',platform:s._id.platform||'',count:s.count,amountCents:s.amountCents})),
  ai:{calls:aiSummary[0]?.calls||0,estimatedUsd:aiSummary[0]?.priced===aiSummary[0]?.calls?Number((aiSummary[0]?.estimatedUsd||0).toFixed(6)):null},
  notes:['Retenção: entre os cadastrados nos '+days+' dias anteriores ao período, quantos voltaram a utilizar o MotoPRO no período selecionado.',
   'Receita aprovada: pagamentos efetivamente aprovados no período. Projeção mensal: valor teórico equivalente a 30 dias das assinaturas atualmente ativas, não previsão garantida.',
   'Ganhos de motoboys e despesas privadas são exibidos somente como totais agregados. A métrica de atividade depende de requisições autenticadas.']});
}));
