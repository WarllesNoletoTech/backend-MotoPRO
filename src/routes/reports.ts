import {Router} from 'express';
import mongoose from 'mongoose';
import {z} from 'zod';
import {User} from '../models/User.js';
import {Entry} from '../models/Entry.js';
import {uid} from '../services/auth.js';
import {asyncRoute} from '../utils/http.js';
import {addDays,dateInTimezone,weekRangeTuesday} from '../utils/dates.js';
import {financialSummary} from './dashboard.js';
import {WeeklyReportDelivery} from '../models/WeeklyReportDelivery.js';

export const reportsRouter=Router();
reportsRouter.get('/weekly',asyncRoute(async(req,res)=>{
 const {weeksAgo}=z.object({weeksAgo:z.coerce.number().int().min(0).max(12).default(1)}).parse(req.query);
 const user=await User.findById(uid(req)).select('timezone');
 const today=dateInTimezone(user?.timezone||'America/Belem');
 const week=weekRangeTuesday(today);
 const from=addDays(week.from,-7*weeksAgo),to=addDays(from,6),previousFrom=addDays(from,-7);
 const [current,previous,categories,count,integratedCount]=await Promise.all([
  financialSummary(uid(req),from,to),
  financialSummary(uid(req),previousFrom,addDays(previousFrom,6)),
  Entry.aggregate<{_id:{type:string;category:string};totalCents:number;count:number}>([
   {$match:{userId:new mongoose.Types.ObjectId(uid(req)),occurredOn:{$gte:from,$lte:to}}},
   {$group:{_id:{type:'$type',category:'$category'},totalCents:{$sum:'$amountCents'},count:{$sum:1}}},
   {$sort:{'_id.type':1,totalCents:-1}}
  ]),
  Entry.countDocuments({userId:uid(req),occurredOn:{$gte:from,$lte:to}}),
  Entry.countDocuments({userId:uid(req),occurredOn:{$gte:from,$lte:to},source:'integration'})
 ]);
 res.setHeader('Cache-Control','private, no-store');
 res.json({period:{from,to},generatedAt:new Date(),
  ...current,entriesCount:count,integratedCount,
  previousProfitCents:previous.profitCents,
  profitChangeCents:current.profitCents-previous.profitCents,
  categories:categories.map(c=>({type:c._id.type,category:c._id.category,totalCents:c.totalCents,count:c.count})),
  message:'Fechamento calculado a partir dos lançamentos salvos. Revise despesas não registradas antes de tomar decisões.'});
}));

// Histórico próprio de entregas de relatórios. Não expõe endereço nem dados de outros usuários.
reportsRouter.get('/deliveries',asyncRoute(async(req,res)=>{
 const items=await WeeklyReportDelivery.find({userId:uid(req)})
  .sort({periodFrom:-1}).limit(12).select('periodFrom periodTo status sentAt attempts').lean();
 res.setHeader('Cache-Control','private, no-store');
 res.json({items:items.map(x=>({period:{from:x.periodFrom,to:x.periodTo},status:x.status,sentAt:x.sentAt,attempts:x.attempts}))});
}));
