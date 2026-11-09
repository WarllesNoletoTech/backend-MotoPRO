import type {Request,Response} from 'express';
import jwt from 'jsonwebtoken';
import {User} from '../models/User.js';
import {config} from '../config.js';
import {asyncRoute,HttpError} from '../utils/http.js';
const COOKIE='motopro_session';
export const userResponse=(u:{_id:unknown;name:string;email:string;role:string;trialEndsAt?:Date})=>({id:String(u._id),name:u.name,email:u.email,role:u.role,trialEndsAt:u.trialEndsAt});
export function setSession(res:Response,userId:string){
  const token=jwt.sign({sub:userId},config.jwtSecret,{expiresIn:'7d',issuer:'motopro'});
  res.cookie(COOKIE,token,{httpOnly:true,secure:config.isProd,sameSite:'lax',path:'/',maxAge:7*86400_000});
}
export function clearSession(res:Response){res.clearCookie(COOKIE,{httpOnly:true,secure:config.isProd,sameSite:'lax',path:'/'});}
export type AuthedRequest=Request&{authUserId:string};
export const requireAuth=asyncRoute(async(req,_res,next)=>{
  const token=req.cookies?.[COOKIE];
  if(!token)throw new HttpError(401,'Faça login para continuar');
  let payload:jwt.JwtPayload;
  try{const decoded=jwt.verify(token,config.jwtSecret,{issuer:'motopro'});if(typeof decoded==='string'||!decoded.sub)throw new Error('token');payload=decoded;}
  catch{throw new HttpError(401,'Sessão expirada. Entre novamente.');}
  const user=await User.findById(payload.sub).select('_id');
  if(!user)throw new HttpError(401,'Conta não encontrada');
  (req as AuthedRequest).authUserId=String(user._id);
  next();
});
export const uid=(req:Request)=>(req as AuthedRequest).authUserId;
