import {Router} from 'express';
import {z} from 'zod';
import {Goal} from '../models/Goal.js';
import {uid} from '../services/auth.js';
import {asyncRoute} from '../utils/http.js';
export const goalsRouter=Router();
goalsRouter.get('/',asyncRoute(async(req,res)=>{res.json({goal:await Goal.findOne({userId:uid(req)}).lean()});}));
goalsRouter.put('/',asyncRoute(async(req,res)=>{
  const {weeklyTargetCents}=z.object({weeklyTargetCents:z.number().int().min(100).max(100_000_000)}).parse(req.body);
  const goal=await Goal.findOneAndUpdate({userId:uid(req)},{$set:{weeklyTargetCents}},{new:true,upsert:true,runValidators:true});res.json({goal});
}));

// Meta mensal independente da semanal, preservando metas legadas.
goalsRouter.put('/monthly',asyncRoute(async(req,res)=>{
  const {monthlyTargetCents}=z.object({monthlyTargetCents:z.number().int().min(100).max(100_000_000)}).strict().parse(req.body);
  const goal=await Goal.findOneAndUpdate({userId:uid(req)},{$set:{monthlyTargetCents}},{new:true,upsert:true,runValidators:true});
  res.json({goal});
}));
