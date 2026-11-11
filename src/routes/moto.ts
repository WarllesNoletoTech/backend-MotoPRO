import {Router} from 'express';
import {z} from 'zod';
import {Motorcycle} from '../models/Motorcycle.js';
import {Maintenance} from '../models/Maintenance.js';
import {MaintenancePlan} from '../models/MaintenancePlan.js';
import {maintenanceStatus} from '../services/maintenancePlanner.js';
import {Entry} from '../models/Entry.js';
import mongoose from 'mongoose';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError,validId} from '../utils/http.js';
import {dateInTimezone,isValidDateOnly} from '../utils/dates.js';
export const motoRouter=Router();
const bikeSchema=z.object({model:z.string().trim().min(2).max(100),year:z.number().int().min(1980).max(2100).optional(),odometerKm:z.number().min(0).max(2_000_000),kmPerLiter:z.number().min(1).max(150).optional()});
const reminderSchema=z.object({label:z.string().trim().min(2).max(120),dueOn:z.string().refine(isValidDateOnly).optional(),dueKm:z.number().min(0).max(2_000_000).optional()}).refine(v=>Boolean(v.dueOn||v.dueKm!==undefined),'Informe data ou quilometragem');
motoRouter.get('/',asyncRoute(async(req,res)=>{
  const [motorcycle,reminders]=await Promise.all([Motorcycle.findOne({userId:uid(req)}).lean(),Maintenance.find({userId:uid(req),done:false}).sort({dueOn:1,dueKm:1}).lean()]);
  res.json({motorcycle,reminders});
}));
motoRouter.put('/',asyncRoute(async(req,res)=>{
  const data=bikeSchema.parse(req.body);
  const motorcycle=await Motorcycle.findOneAndUpdate({userId:uid(req)},{$set:data},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});
  res.json({motorcycle});
}));
motoRouter.post('/reminders',asyncRoute(async(req,res)=>{
  const data=reminderSchema.parse(req.body);
  const reminder=await Maintenance.create({userId:uid(req),...data});res.status(201).json({reminder});
}));
motoRouter.patch('/reminders/:id/done',asyncRoute(async(req,res)=>{
  if(!validId(req.params.id))throw new HttpError(400,'ID inválido');
  const reminder=await Maintenance.findOneAndUpdate({_id:req.params.id,userId:uid(req)},{$set:{done:true}},{new:true});
  if(!reminder)throw new HttpError(404,'Lembrete não encontrado');res.json({reminder});
}));

// Os abastecimentos reutilizam lançamentos financeiros (categoria fuel).
// Isso evita duas despesas para uma mesma compra e preserva exportação e relatórios.
motoRouter.get('/fuel',asyncRoute(async(req,res)=>{
  const userId=uid(req);
  const from=dateInTimezone().slice(0,7)+'-01';
  const to=from.slice(0,7)+'-31';
  const [items,totals]=await Promise.all([
    Entry.find({userId,type:'expense',category:'fuel'})
      .select('_id amountCents occurredOn description source fuelLiters odometerKm fuelType fuelStation')
      .sort({occurredOn:-1,createdAt:-1}).limit(30).lean(),
    Entry.aggregate<{_id:null;amountCents:number;liters:number;count:number}>([
      {$match:{userId:new mongoose.Types.ObjectId(userId),type:'expense',category:'fuel',occurredOn:{$gte:from,$lte:to}}},
      {$group:{_id:null,amountCents:{$sum:'$amountCents'},liters:{$sum:{$ifNull:['$fuelLiters',0]}},count:{$sum:1}}}
    ])
  ]);
  const summary=totals[0]||{amountCents:0,liters:0,count:0};
  res.json({items,summary:{month:from.slice(0,7),amountCents:summary.amountCents,liters:Number(summary.liters.toFixed(3)),count:summary.count}});
}));


// Planos periódicos definidos pelo usuário, conforme o manual do fabricante.
const planSchema=z.object({
 label:z.string().trim().min(2).max(120),
 intervalKm:z.number().int().min(100).max(100_000).optional(),
 intervalDays:z.number().int().min(1).max(3650).optional(),
 lastServiceKm:z.number().int().min(0).max(2_000_000).optional(),
 lastServiceOn:z.string().refine(isValidDateOnly).optional()
}).superRefine((v,ctx)=>{
 if(v.intervalKm===undefined&&v.intervalDays===undefined)ctx.addIssue({code:'custom',message:'Informe intervalo em km ou dias'});
 if(v.intervalKm!==undefined&&v.lastServiceKm===undefined)ctx.addIssue({code:'custom',message:'Informe KM da última manutenção'});
 if(v.intervalDays!==undefined&&v.lastServiceOn===undefined)ctx.addIssue({code:'custom',message:'Informe data da última manutenção'});
 if(v.lastServiceOn&&v.lastServiceOn>dateInTimezone('America/Belem'))ctx.addIssue({code:'custom',message:'Data da última manutenção não pode ser futura'});
});
motoRouter.get('/maintenance-plans',asyncRoute(async(req,res)=>{
 const userId=uid(req);
 const [bike,plans]=await Promise.all([Motorcycle.findOne({userId}).select('odometerKm').lean(),MaintenancePlan.find({userId,enabled:true}).sort({createdAt:-1}).limit(100).lean()]);
 const odometerKm=Number((bike as {odometerKm?:number}|null)?.odometerKm||0);
 const today=dateInTimezone('America/Belem');
 res.json({odometerKm,items:plans.map(x=>({_id:String(x._id),label:x.label,intervalKm:x.intervalKm,intervalDays:x.intervalDays,lastServiceKm:x.lastServiceKm,lastServiceOn:x.lastServiceOn,...maintenanceStatus(x as unknown as {label:string;intervalKm?:number;intervalDays?:number;lastServiceKm?:number;lastServiceOn?:string;enabled?:boolean},odometerKm,today)}))});
}));
motoRouter.post('/maintenance-plans',asyncRoute(async(req,res)=>{
 const data=planSchema.parse(req.body);
 const count=await MaintenancePlan.countDocuments({userId:uid(req),enabled:true});
 if(count>=30)throw new HttpError(409,'Limite de 30 planos ativos atingido');
 const plan=await MaintenancePlan.create({userId:uid(req),...data});
 res.status(201).json({plan});
}));
motoRouter.patch('/maintenance-plans/:id/serviced',asyncRoute(async(req,res)=>{
 if(!validId(req.params.id))throw new HttpError(400,'ID inválido');
 const data=z.object({lastServiceKm:z.number().int().min(0).max(2_000_000).optional(),lastServiceOn:z.string().refine(isValidDateOnly).optional()}).parse(req.body);
 const existing=await MaintenancePlan.findOne({_id:req.params.id,userId:uid(req),enabled:true});
 if(!existing)throw new HttpError(404,'Plano não encontrado');
 const today=dateInTimezone('America/Belem');
 if(data.lastServiceOn&&data.lastServiceOn>today)throw new HttpError(400,'Data futura inválida');
 const moto=(await Motorcycle.findOne({userId:uid(req)}).select('odometerKm').lean()) as {odometerKm?:number}|null;
 const km=data.lastServiceKm??Number(moto?.odometerKm||0);
 if(existing.intervalKm!==undefined&&km<Number(existing.lastServiceKm||0))throw new HttpError(400,'A quilometragem não pode retroceder');
 existing.set('lastServiceKm',km);
 existing.set('lastServiceOn',data.lastServiceOn||today);
 existing.set('lastCompletedAt',new Date());
 await existing.save();res.json({plan:existing});
}));
motoRouter.delete('/maintenance-plans/:id',asyncRoute(async(req,res)=>{
 if(!validId(req.params.id))throw new HttpError(400,'ID inválido');
 const plan=await MaintenancePlan.findOneAndUpdate({_id:req.params.id,userId:uid(req)},{$set:{enabled:false}});
 if(!plan)throw new HttpError(404,'Plano não encontrado');
 res.json({ok:true});
}));
