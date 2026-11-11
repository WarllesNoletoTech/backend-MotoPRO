import {randomUUID} from 'node:crypto';
import type {Request,Response,NextFunction} from 'express';
import {OperationalEvent} from '../models/OperationalEvent.js';
/** Correlaciona falhas sem registrar informações privadas de clientes. */
export function observeRequests(req:Request,res:Response,next:NextFunction){
 const started=performance.now();
 const requestId=randomUUID();
 res.setHeader('X-Request-ID',requestId);
 res.on('finish',()=>{
  if(!req.originalUrl.startsWith('/api/'))return;
  const durationMs=Math.max(0,Math.round(performance.now()-started));
  if(res.statusCode<500 && durationMs<2500)return;
  // Somente templates de rota. Nunca usar req.path/originalUrl (contêm IDs/queries).
  const knownPath=typeof req.route?.path==='string'?req.route.path:'(sem rota)';
  const route=knownPath==='(sem rota)'?'(sem rota)':`${req.baseUrl}${knownPath}`;
  void OperationalEvent.create({kind:res.statusCode>=500?'error':'slow',method:req.method,
   route:route.slice(0,150),status:res.statusCode,durationMs:Math.min(durationMs,600000),requestId})
   .catch(()=>{ /* Monitoramento não pode interromper a API por indisponibilidade do MongoDB. */ });
 });
 next();
}
