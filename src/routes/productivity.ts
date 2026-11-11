import {Router} from 'express';
import mongoose from 'mongoose';
import {z} from 'zod';
import {User} from '../models/User.js';
import {Entry} from '../models/Entry.js';
import {financialSummary} from './dashboard.js';
import {uid} from '../services/auth.js';
import {dateInTimezone} from '../utils/dates.js';
import {validMonth} from '../services/recurringDates.js';
import {asyncRoute,HttpError} from '../utils/http.js';
export const productivityRouter=Router();
function previousMonth(month:string){
 const [year,m]=month.split('-').map(Number);return `${year-(m===1?1:0)}-${String(m===1?12:m-1).padStart(2,'0')}`;
}
function lastDay(month:string){const [year,m]=month.split('-').map(Number);return `${month}-${new Date(Date.UTC(year,m,0)).getUTCDate()}`;}
productivityRouter.get('/',asyncRoute(async(req,res)=>{
 const {month:monthQuery}=z.object({month:z.string().optional()}).parse(req.query);
 const user=(await User.findById(uid(req)).select('timezone').lean()) as unknown as {timezone?:string}|null;
 if(!user)throw new HttpError(404,'Conta não encontrada');
 const today=dateInTimezone(user.timezone||'America/Belem');
 const month=monthQuery||today.slice(0,7);
 if(!validMonth(month)||month>today.slice(0,7)||month<previousMonth(previousMonth(previousMonth(previousMonth(today.slice(0,7))))) )throw new HttpError(400,'Selecione um dos últimos 5 meses');
 const previous=previousMonth(month);
 const from=month+'-01',to=month===today.slice(0,7)?today:lastDay(month);
 const prevFrom=previous+'-01',prevTo=lastDay(previous);
 const [summary,previousSummary,distribution,deliveryLaunches]=await Promise.all([
  financialSummary(uid(req),from,to),financialSummary(uid(req),prevFrom,prevTo),
  Entry.aggregate<{_id:{type:string;category:string};totalCents:number;count:number}>([
   {$match:{userId:new mongoose.Types.ObjectId(uid(req)),occurredOn:{$gte:from,$lte:to}}},
   {$group:{_id:{type:'$type',category:'$category'},totalCents:{$sum:'$amountCents'},count:{$sum:1}}}
  ]),
  Entry.countDocuments({userId:uid(req),type:'income',category:'delivery',occurredOn:{$gte:from,$lte:to}})
 ]);
 const activeDays=summary.byDay.filter(d=>d.incomeCents>0||d.expenseCents>0).length;
 const elapsedDays=summary.byDay.length;
 const averageProfitPerDayCents=elapsedDays?Math.round(summary.profitCents/elapsedDays):0;
 const averageDeliveryEntryCents=deliveryLaunches?Math.round(distribution.filter(d=>d._id.type==='income'&&d._id.category==='delivery').reduce((sum,d)=>sum+d.totalCents,0)/deliveryLaunches):0;
 res.setHeader('Cache-Control','private, no-store');
 res.json({month,period:{from,to},...summary,previous:{month:previous,profitCents:previousSummary.profitCents,incomeCents:previousSummary.incomeCents,expenseCents:previousSummary.expenseCents},
  deltaProfitCents:summary.profitCents-previousSummary.profitCents,activeDays,elapsedDays,averageProfitPerDayCents,deliveryLaunches,averageDeliveryEntryCents,
  expenseSharePercent:summary.incomeCents>0?Math.round(summary.expenseCents/summary.incomeCents*100):null,
  breakdown:distribution.map(d=>({type:d._id.type,category:d._id.category,totalCents:d.totalCents,count:d.count})),
  note:'Médias calculadas por dia de calendário e por lançamento. Um lançamento de plataforma pode representar várias entregas.'});
}));
