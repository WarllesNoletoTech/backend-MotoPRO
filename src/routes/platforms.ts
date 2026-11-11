import {Router} from 'express';
import mongoose from 'mongoose';
import {z} from 'zod';
import {Entry} from '../models/Entry.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {dateInTimezone,isValidDateOnly} from '../utils/dates.js';
import {platformOf,PLATFORM_LABELS,PLATFORMS, type PlatformKey} from '../services/phase3.js';

export const platformsRouter=Router();
const parseDateRange=(q:unknown)=>{
 const query=z.object({from:z.string().refine(isValidDateOnly).optional(),to:z.string().refine(isValidDateOnly).optional()}).parse(q);
 const today=dateInTimezone('America/Belem');
 const to=query.to||today,from=query.from||`${to.slice(0,7)}-01`;
 if(from>to || to>today || new Date(to+'T12:00:00Z').getTime()-new Date(from+'T12:00:00Z').getTime()>365*86400_000)
  throw new HttpError(400,'Selecione um período de até 366 dias sem datas futuras');
 return {from,to};
};
platformsRouter.get('/',asyncRoute(async(req,res)=>{
 const {from,to}=parseDateRange(req.query);
 const userId=new mongoose.Types.ObjectId(uid(req));
 const income=await Entry.aggregate<{_id:{provider?:string;source?:string;platform?:string;month:string};amountCents:number;count:number}>([
  {$match:{userId,type:'income',occurredOn:{$gte:from,$lte:to}}},
  {$group:{_id:{source:'$source',provider:'$provider',platform:'$platform',month:{$substrBytes:['$occurredOn',0,7]}},amountCents:{$sum:'$amountCents'},count:{$sum:1}}}
 ]);
 const expense=await Entry.aggregate<{_id:null;amountCents:number;count:number}>([
  {$match:{userId,type:'expense',occurredOn:{$gte:from,$lte:to}}},
  {$group:{_id:null,amountCents:{$sum:'$amountCents'},count:{$sum:1}}}
 ]);
 const sources=new Map<PlatformKey,{key:PlatformKey;label:string;amountCents:number;count:number;importedCount:number}>();
 const months=new Map<string,{month:string;incomeCents:number;breakdown:Record<string,number>}>();
 for(const p of PLATFORMS)sources.set(p,{key:p,label:PLATFORM_LABELS[p],amountCents:0,count:0,importedCount:0});
 for(const row of income){
  const key=platformOf(row._id);
  const source=sources.get(key)!;
  source.amountCents+=row.amountCents;source.count+=row.count;
  if(row._id.source==='integration')source.importedCount+=row.count;
  const month=row._id.month;
  if(!months.has(month))months.set(month,{month,incomeCents:0,breakdown:{}});
  const m=months.get(month)!;m.incomeCents+=row.amountCents;
  m.breakdown[key]=(m.breakdown[key]||0)+row.amountCents;
 }
 const incomeCents=[...sources.values()].reduce((s,v)=>s+v.amountCents,0),expenseCents=expense[0]?.amountCents||0;
 res.setHeader('Cache-Control','private, no-store');
 res.json({period:{from,to},incomeCents,expenseCents,profitCents:incomeCents-expenseCents,
  disclaimer:'Despesas gerais não são distribuídas entre plataformas. Valores por origem são receitas brutas, não lucro líquido de cada plataforma. iFood e outras plataformas são informadas manualmente, exceto importações Rappidex.',
  sources:[...sources.values()].filter(x=>x.amountCents||x.count).sort((a,b)=>b.amountCents-a.amountCents),
  months:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month))});
}));
