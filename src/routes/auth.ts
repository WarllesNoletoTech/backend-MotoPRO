import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {User} from '../models/User.js';
import {getAdminSettings} from '../models/AdminSetting.js';
import {trialEndsAtFromDays} from '../services/premiumPolicy.js';
import {normalizeBrazilMobilePhone} from '../utils/phone.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {clearSession,requireAuth,setSession,uid,userResponse} from '../services/auth.js';
export const authRouter=Router();
const limit=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Muitas tentativas. Aguarde alguns minutos.'}});
const phone=z.string().trim().min(10).max(32).refine(v=>normalizeBrazilMobilePhone(v)!==null,{message:'Informe um celular brasileiro válido com DDD (ex.: 94 99999-1234)'}).transform(v=>normalizeBrazilMobilePhone(v)!);
const register=z.object({name:z.string().trim().min(2).max(90),email:z.string().trim().email().max(180).transform(s=>s.toLowerCase()),phone,password:z.string().min(8).max(128)});
const login=z.object({email:z.string().trim().email().transform(s=>s.toLowerCase()),password:z.string().min(1)});
authRouter.post('/register',limit,asyncRoute(async(req,res)=>{
  const data=register.parse(req.body);
  if(await User.exists({email:data.email}))throw new HttpError(409,'Este e-mail já está cadastrado');
  const settings=await getAdminSettings();
  if(!settings.newRegistrationsOpen)throw new HttpError(503,'Novos cadastros estão temporariamente indisponíveis');
  const passwordHash=await bcrypt.hash(data.password,12);
  const user=await User.create({name:data.name,email:data.email,phone:data.phone,passwordHash,trialEndsAt:trialEndsAtFromDays(settings.trialDays)});
  setSession(res,String(user._id));res.status(201).json({user:userResponse(user)});
}));
authRouter.post('/login',limit,asyncRoute(async(req,res)=>{
  const {email,password}=login.parse(req.body);
  const user=await User.findOne({email}).select('+passwordHash');
  if(!user||!await bcrypt.compare(password,user.passwordHash))throw new HttpError(401,'E-mail ou senha inválidos');
  if(user.blockedAt)throw new HttpError(403,'Conta temporariamente bloqueada. Contate o suporte.');
  await User.updateOne({_id:user._id},{$set:{lastLoginAt:new Date()}});
  setSession(res,String(user._id));res.json({user:userResponse(user)});
}));
authRouter.post('/logout',(_req,res)=>{clearSession(res);res.json({ok:true});});
authRouter.get('/me',requireAuth,asyncRoute(async(req,res)=>{
  const user=await User.findById(uid(req));
  if(!user)throw new HttpError(401,'Conta não encontrada');
  res.json({user:userResponse(user)});
}));

// Usuários anteriores à V3.11 completam o celular após o login, sem perder histórico ou assinatura.
authRouter.patch('/phone',requireAuth,asyncRoute(async(req,res)=>{
 const data=z.object({phone}).strict().parse(req.body);
 const user=await User.findById(uid(req));
 if(!user)throw new HttpError(401,'Conta não encontrada');
 user.set('phone',data.phone);
 await user.save();
 res.setHeader('Cache-Control','private, no-store');
 res.json({user:userResponse(user)});
}));
