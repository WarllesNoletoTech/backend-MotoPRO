import {Router} from 'express';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {getUserAlerts} from '../services/alertCenter.js';
export const alertsRouter=Router();
alertsRouter.get('/',asyncRoute(async(req,res)=>{
 const payload=await getUserAlerts(uid(req));
 if(!payload)throw new HttpError(404,'Conta não encontrada');
 res.setHeader('Cache-Control','private, no-store');
 res.json(payload);
}));
