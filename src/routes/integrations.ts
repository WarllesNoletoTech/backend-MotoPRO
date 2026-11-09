import {Router} from 'express';
import {z} from 'zod';
import {uid} from '../services/auth.js';
import {requirePremium} from '../services/premium.js';
import {asyncRoute} from '../utils/http.js';
import {isValidDateOnly} from '../utils/dates.js';
import {getConnection,linkRappidex,unlinkRappidex,syncRappidex,rappidexReady} from '../services/rappidex.js';
export const integrationsRouter=Router();
const link=z.object({code:z.string().trim().regex(/^[0-9a-f]{48}$/i)});
const sync=z.object({from:z.string().refine(isValidDateOnly).optional(),to:z.string().refine(isValidDateOnly).optional(),force:z.boolean().optional()}).default({});
integrationsRouter.get('/',asyncRoute(async(req,res)=>{
 const c=await getConnection(uid(req));res.json({providers:[{id:'rappidex',name:'Rappidex',status:c?'connected':rappidexReady()?'available':'not_configured',connection:c},{id:'ifood',name:'iFood',status:'not_available'}]});
}));
integrationsRouter.post('/rappidex/link',requirePremium,asyncRoute(async(req,res)=>res.json(await linkRappidex(uid(req),link.parse(req.body||{}).code))));
integrationsRouter.post('/rappidex/sync',requirePremium,asyncRoute(async(req,res)=>res.json(await syncRappidex(uid(req),sync.parse(req.body||{})))));
integrationsRouter.delete('/rappidex/link',asyncRoute(async(req,res)=>res.json(await unlinkRappidex(uid(req)))));
