import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {User} from '../models/User.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {clearSession,requireAuth,setSession,uid,userResponse} from '../services/auth.js';
export const authRouter=Router();
const limit=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Muitas tentativas. Aguarde alguns minutos.'}});
const register=z.object({name:z.string().trim().min(2).max(90),email:z.string().trim().email().max(180).transform(s=>s.toLowerCase()),password:z.string().min(8).max(128)});
const login=z.object({email:z.string().trim().email().transform(s=>s.toLowerCase()),password:z.string().min(1)});
authRouter.post('/register',limit,asyncRoute(async(req,res)=>{
  const data=register.parse(req.body);
  if(await User.exists({email:data.email}))throw new HttpError(409,'Este e-mail já está cadastrado');
  const passwordHash=await bcrypt.hash(data.password,12);
  const user=await User.create({name:data.name,email:data.email,passwordHash});
  setSession(res,String(user._id));res.status(201).json({user:userResponse(user)});
}));
authRouter.post('/login',limit,asyncRoute(async(req,res)=>{
  const {email,password}=login.parse(req.body);
  const user=await User.findOne({email}).select('+passwordHash');
  if(!user||!await bcrypt.compare(password,user.passwordHash))throw new HttpError(401,'E-mail ou senha inválidos');
  setSession(res,String(user._id));res.json({user:userResponse(user)});
}));
authRouter.post('/logout',(_req,res)=>{clearSession(res);res.json({ok:true});});
authRouter.get('/me',requireAuth,asyncRoute(async(req,res)=>{
  const user=await User.findById(uid(req));
  if(!user)throw new HttpError(401,'Conta não encontrada');
  res.json({user:userResponse(user)});
}));
