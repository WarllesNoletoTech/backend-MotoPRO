import type {Request,Response,NextFunction} from 'express';
import {config} from '../config.js';
/** Proteção de mudanças de estado feitas com cookie de sessão. */
export function protectBrowserWrites(req:Request,res:Response,next:NextFunction){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 // Mercado Pago autentica o webhook por x-signature, sem cookie de sessão.
 if(req.path.startsWith('/api/webhooks/mercadopago'))return next();
 const site=req.header('sec-fetch-site');
 if(site==='cross-site')return res.status(403).json({error:'Solicitação externa não permitida'});
 const origin=req.header('origin');
 if(origin && origin!==config.appOrigin)return res.status(403).json({error:'Origem não autorizada'});
 const referer=req.header('referer');
 if(!origin && referer){
  try{if(new URL(referer).origin!==config.appOrigin)return res.status(403).json({error:'Referência não autorizada'});}
  catch{return res.status(403).json({error:'Referência inválida'});}
 }
 next();
}
