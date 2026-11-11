import {Router} from 'express';
import {z} from 'zod';
import {RecurringExpense} from '../models/RecurringExpense.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError,validId} from '../utils/http.js';
import {dateInTimezone} from '../utils/dates.js';
import {syncRecurringExpenses} from '../services/recurringExpenses.js';
import {nextPaymentDate,monthDueDate,nextMonth} from '../services/recurringDates.js';
import {Entry} from '../models/Entry.js';
import {User} from '../models/User.js';
export const recurringExpensesRouter=Router();
const schema=z.object({
 label:z.string().trim().min(2).max(100),
 category:z.enum(['fuel','maintenance','food','other']),
 amountCents:z.number().int().positive().max(100_000_000),
 dayOfMonth:z.number().int().min(1).max(31),
 enabled:z.boolean().default(true)
}).strict();
const patch=z.object({label:z.string().trim().min(2).max(100).optional(),category:z.enum(['fuel','maintenance','food','other']).optional(),
 amountCents:z.number().int().positive().max(100_000_000).optional(),dayOfMonth:z.number().int().min(1).max(31).optional(),enabled:z.boolean().optional()
}).strict().refine(v=>Object.keys(v).length>0,'Informe ao menos um campo');
async function currentDay(userId:string){
 const user=(await User.findById(userId).select('timezone').lean()) as unknown as {timezone?:string}|null;
 return dateInTimezone(user?.timezone||'America/Belem');
}
recurringExpensesRouter.get('/',asyncRoute(async(req,res)=>{
 const id=uid(req),today=await currentDay(id);
 const docs=await RecurringExpense.find({userId:id}).sort({enabled:-1,createdAt:-1}).limit(100).lean();
 const existing=await Entry.find({userId:id,source:'recurring',recurrenceMonth:today.slice(0,7),recurrenceId:{$in:docs.map(d=>d._id)}}).select('recurrenceId').lean();
 const postedThisMonth=new Set(existing.map(e=>String(e.recurrenceId)));
 res.setHeader('Cache-Control','private, no-store');
 res.json({today,items:docs.map(d=>({id:String(d._id),label:d.label,category:d.category,amountCents:d.amountCents,dayOfMonth:d.dayOfMonth,startMonth:d.startMonth,enabled:!!d.enabled,nextDueOn:d.enabled?(postedThisMonth.has(String(d._id))?monthDueDate(nextMonth(today.slice(0,7)),Number(d.dayOfMonth)):nextPaymentDate(Number(d.dayOfMonth),String(d.startMonth),today)):null,postedThisMonth:postedThisMonth.has(String(d._id))}))});
}));
recurringExpensesRouter.post('/',asyncRoute(async(req,res)=>{
 const data=schema.parse(req.body),id=uid(req);
 if(await RecurringExpense.countDocuments({userId:id})>=30)throw new HttpError(409,'Limite de 30 despesas recorrentes. Exclua uma regra antiga.');
 const today=await currentDay(id);
 const item=await RecurringExpense.create({userId:id,...data,startMonth:today.slice(0,7)});
 res.status(201).json({item:{id:String(item._id)}});
}));
recurringExpensesRouter.patch('/:id',asyncRoute(async(req,res)=>{
 if(!validId(req.params.id))throw new HttpError(400,'ID inválido');
 const data=patch.parse(req.body);
 const item=await RecurringExpense.findOneAndUpdate({_id:req.params.id,userId:uid(req)},{$set:data},{new:true,runValidators:true});
 if(!item)throw new HttpError(404,'Despesa recorrente não encontrada');
 res.json({ok:true});
}));
recurringExpensesRouter.delete('/:id',asyncRoute(async(req,res)=>{
 if(!validId(req.params.id))throw new HttpError(400,'ID inválido');
 const item=await RecurringExpense.findOneAndDelete({_id:req.params.id,userId:uid(req)});
 if(!item)throw new HttpError(404,'Despesa recorrente não encontrada');
 res.json({ok:true,message:'Regra excluída. Lançamentos anteriores foram preservados.'});
}));
recurringExpensesRouter.post('/sync',asyncRoute(async(req,res)=>{
 // Requisição autenticada e protegida por CSRF. Sem operações externas de pagamento.
 const result=await syncRecurringExpenses(uid(req));
 res.setHeader('Cache-Control','no-store');res.json(result);
}));
