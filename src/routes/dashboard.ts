import {Router} from 'express';
import mongoose from 'mongoose';
const { Types } = mongoose;
import {Entry} from '../models/Entry.js';
import {Goal} from '../models/Goal.js';
import {User} from '../models/User.js';
import {uid} from '../services/auth.js';
import {addDays,dateInTimezone,isValidDateOnly,weekRangeTuesday} from '../utils/dates.js';
import {asyncRoute,HttpError} from '../utils/http.js';
export const dashboardRouter=Router();
export async function financialSummary(userId:string,from:string,to:string){
  const grouped=await Entry.aggregate<{_id:{type:'income'|'expense';day:string};total:number}>([
    {$match:{userId:new Types.ObjectId(userId),occurredOn:{$gte:from,$lte:to}}},
    {$group:{_id:{type:'$type',day:'$occurredOn'},total:{$sum:'$amountCents'}}}
  ]);
  let incomeCents=0,expenseCents=0;
  const days=new Map<string,{day:string;incomeCents:number;expenseCents:number}>();
  for(let day=from;day<=to;day=addDays(day,1))days.set(day,{day,incomeCents:0,expenseCents:0});
  for(const row of grouped){
    if(row._id.type==='income')incomeCents+=row.total;else expenseCents+=row.total;
    const daily=days.get(row._id.day);
    if(daily){if(row._id.type==='income')daily.incomeCents+=row.total;else daily.expenseCents+=row.total;}
  }
  return {incomeCents,expenseCents,profitCents:incomeCents-expenseCents,byDay:[...days.values()]};
}
dashboardRouter.get('/',asyncRoute(async(req,res)=>{
  const user=await User.findById(uid(req)).select('timezone');
  const range=weekRangeTuesday(dateInTimezone(user?.timezone||'America/Belem'));
  const from=String(req.query.from||range.from),to=String(req.query.to||range.to);
  if(!isValidDateOnly(from)||!isValidDateOnly(to)||from>to)throw new HttpError(400,'Período inválido');
  const days=Math.round((new Date(`${to}T00:00:00Z`).getTime()-new Date(`${from}T00:00:00Z`).getTime())/86400000)+1;
  if(days>31)throw new HttpError(400,'Período máximo de 31 dias');
  const [summary,goal]=await Promise.all([financialSummary(uid(req),from,to),Goal.findOne({userId:uid(req)}).lean()]);
  res.json({period:{from,to},...summary,goal:goal?{weeklyTargetCents:goal.weeklyTargetCents}:null});
}));
