import {Router} from 'express';
import mongoose from 'mongoose';
import {z} from 'zod';
import {PrivacyRequest} from '../models/PrivacyRequest.js';
import {User} from '../models/User.js';
import {AdminAudit} from '../models/AdminAudit.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';
export const accountPrivacyRouter=Router();
accountPrivacyRouter.get('/',asyncRoute(async(req,res)=>{
 const items=await PrivacyRequest.find({userId:uid(req)}).sort({createdAt:-1}).limit(30).select('type note status response createdAt resolvedAt').lean();
 res.setHeader('Cache-Control','private, no-store');res.json({items});
}));
accountPrivacyRouter.post('/',asyncRoute(async(req,res)=>{
 const data=z.object({type:z.enum(['deletion','correction']),note:z.string().trim().max(500).default('')}).strict().parse(req.body);
 const user=await User.findById(uid(req)).select('role').lean() as unknown as {role?:string}|null;
 if(!user||user.role!=='driver')throw new HttpError(403,'Solicitação disponível para motoboys');
 const existing=await PrivacyRequest.findOne({userId:uid(req),type:data.type,status:'open'});
 if(existing){res.status(409).json({error:'Já existe uma solicitação deste tipo aguardando atendimento.'});return;}
 const doc=await PrivacyRequest.create({userId:uid(req),...data,status:'open'});
 res.status(201).json({id:String(doc._id),status:doc.status});
}));
export const adminPrivacyRouter=Router();
// Somente montar dentro do roteador que já exige administrador.
adminPrivacyRouter.get('/privacy-requests',asyncRoute(async(_req,res)=>{
 const items=await PrivacyRequest.find().sort({createdAt:-1}).limit(80).select('userId type note status response createdAt resolvedAt').lean();
 const userIds=items.map(x=>x.userId);
 const users=await User.find({_id:{$in:userIds}}).select('name email').lean() as unknown as {_id:unknown;name:string;email:string}[];
 const names=new Map(users.map(u=>[String(u._id),{name:u.name,email:u.email}]));
 res.setHeader('Cache-Control','private, no-store');
 res.json({items:items.map(x=>({id:String(x._id),user:names.get(String(x.userId))||null,type:x.type,
  note:x.note,status:x.status,response:x.response,createdAt:x.createdAt,resolvedAt:x.resolvedAt}))});
}));
adminPrivacyRouter.patch('/privacy-requests/:id',asyncRoute(async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id))throw new HttpError(400,'ID inválido');
 const {response}=z.object({response:z.string().trim().min(10).max(500)}).strict().parse(req.body);
 const doc=await PrivacyRequest.findOneAndUpdate({_id:req.params.id,status:'open'},{$set:{status:'resolved',response,resolvedAt:new Date()}},{new:true});
 if(!doc)throw new HttpError(404,'Solicitação não encontrada ou já encerrada');
 await AdminAudit.create({actorId:uid(req),action:'privacy.request.resolved',targetId:doc.userId,metadata:{requestId:String(doc._id),type:doc.type}});
 res.json({ok:true});
}));
