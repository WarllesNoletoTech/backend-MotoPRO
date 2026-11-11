import {Router} from 'express';
import {z} from 'zod';
import {Entry} from '../models/Entry.js';
import {IntegrationConnection} from '../models/IntegrationConnection.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {addDays,dateInTimezone,isValidDateOnly} from '../utils/dates.js';
import {reconcileEntries} from '../services/reconciliation.js';
export const reconciliationRouter=Router();
reconciliationRouter.get('/',asyncRoute(async(req,res)=>{
 const today=dateInTimezone('America/Belem');
 const query=z.object({from:z.string().refine(isValidDateOnly).optional(),to:z.string().refine(isValidDateOnly).optional()}).parse(req.query);
 const to=query.to||today,from=query.from||addDays(to,-29);
 if(from>to||to>today||Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`)>30*86400000)throw new HttpError(400,'Selecione até 31 dias, sem datas futuras');
 const userId=uid(req);
 const [items,connection]=await Promise.all([
  Entry.find({userId,type:'income',category:'delivery',source:{$ne:'private'},occurredOn:{$gte:from,$lte:to}})
   .select('_id amountCents occurredOn source provider description').sort({occurredOn:-1}).limit(5001).lean(),
  IntegrationConnection.exists({userId,provider:'rappidex'})
 ]);
 if(items.length>5000)throw new HttpError(422,'Muitos lançamentos para este período. Selecione menos dias.');
 const rows=items.map(i=>({id:String(i._id),amountCents:Number(i.amountCents),occurredOn:String(i.occurredOn),source:String(i.source),provider:String(i.provider||'')}));
 res.setHeader('Cache-Control','private, no-store');
 res.json({period:{from,to},linked:!!connection,...reconcileEntries(rows)});
}));
