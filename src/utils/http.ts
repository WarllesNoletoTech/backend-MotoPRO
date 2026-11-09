import type {Request,Response,NextFunction} from 'express';
import {ZodError} from 'zod';
import mongoose from 'mongoose';
const { Types } = mongoose;
export type Handler=(req:Request,res:Response,next:NextFunction)=>Promise<unknown>;
export const asyncRoute=(fn:Handler)=>(req:Request,res:Response,next:NextFunction)=>Promise.resolve(fn(req,res,next)).catch(next);
export const validId=(id:string)=>Types.ObjectId.isValid(id);
export class HttpError extends Error{constructor(public statusCode:number,message:string){super(message);}}
export function errorHandler(err:unknown,_req:Request,res:Response,_next:NextFunction){
  if(err instanceof ZodError)return res.status(400).json({error:'Dados inválidos',details:err.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  if(err instanceof HttpError)return res.status(err.statusCode).json({error:err.message});
  if(typeof err==='object'&&err!==null&&'code' in err&&err.code===11000)return res.status(409).json({error:'Registro já existente'});
  const e=err as {name?:string;code?:string}|null;
  if(e?.name==='MulterError'||e?.code==='LIMIT_FILE_SIZE')return res.status(400).json({error:'Áudio inválido ou muito grande'});
  console.error('API error:',err);
  return res.status(500).json({error:'Erro interno. Tente novamente.'});
}
