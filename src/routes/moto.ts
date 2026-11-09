import {Router} from 'express';
import {z} from 'zod';
import {Motorcycle} from '../models/Motorcycle.js';
import {Maintenance} from '../models/Maintenance.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError,validId} from '../utils/http.js';
import {isValidDateOnly} from '../utils/dates.js';
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
