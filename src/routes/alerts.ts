import {Router} from 'express';
import {User} from '../models/User.js';
import {Motorcycle} from '../models/Motorcycle.js';
import {MaintenancePlan} from '../models/MaintenancePlan.js';
import {Maintenance} from '../models/Maintenance.js';
import {PrivateDelivery} from '../models/PrivateDelivery.js';
import {Entry} from '../models/Entry.js';
import {RecurringExpense} from '../models/RecurringExpense.js';
import {uid} from '../services/auth.js';
import {asyncRoute} from '../utils/http.js';
import {dateInTimezone,addDays} from '../utils/dates.js';
import {maintenanceStatus} from '../services/maintenancePlanner.js';
import {daysUntil,nextPaymentDate} from '../services/recurringDates.js';

export const alertsRouter=Router();
type Alert={id:string;level:'warning'|'info';title:string;description:string;href:string;dueOn?:string};
alertsRouter.get('/',asyncRoute(async(req,res)=>{
 const id=uid(req);
 const user=await User.findById(id).select('timezone role').lean() as unknown as {timezone?:string;role?:string}|null;
 if(!user){res.status(404).json({error:'Conta não encontrada'});return;}
 const today=dateInTimezone(user.timezone||'America/Belem');
 const [bike,plans,manualReminders,pending,recurrences]=await Promise.all([
   Motorcycle.findOne({userId:id}).select('odometerKm').lean(),
   MaintenancePlan.find({userId:id,enabled:true}).sort({createdAt:-1}).limit(30).lean(),
   Maintenance.find({userId:id,done:false}).sort({dueOn:1}).limit(30).lean(),
   PrivateDelivery.find({userId:id}).sort({deliveredOn:1}).limit(500).select('_id amountCents deliveredOn').lean(),
   RecurringExpense.find({userId:id,enabled:true}).limit(30).lean()
 ]);
 const alerts:Alert[]=[];
 const entriesThisMonth=await Entry.find({userId:id,source:'recurring',recurrenceMonth:today.slice(0,7),recurrenceId:{$in:recurrences.map(r=>r._id)}}).select('recurrenceId').lean();
 const postedIds=new Set(entriesThisMonth.map(e=>String(e.recurrenceId)));
 // Na Fase 3, o recebimento é identificado por Entry(provider='private', externalId).
 // PrivateDelivery não possui campo paymentStatus persistido.
 const paid=await Entry.find({userId:id,provider:'private',externalId:{$in:pending.map(p=>String(p._id))}}).select('externalId').lean();
 const paidIds=new Set(paid.map(p=>String(p.externalId)));
 const outstanding=pending.filter(p=>!paidIds.has(String(p._id)));
 const pendingCents=outstanding.reduce((sum,p)=>sum+Number(p.amountCents||0),0);
 if(outstanding.length){
   alerts.push({id:'private-pending',level:'warning',title:`${outstanding.length}${pending.length===500?'+':''} entrega(s) a receber`,
    description:`Você possui R$ ${(pendingCents/100).toFixed(2).replace('.',',')} pendentes em ${outstanding.length} entrega(s)${pending.length===500?' (verificação limitada a 500 entregas)':''}. Confira os recebimentos antes de confirmar.`,href:'/app/particulares'});
 }
 const km=Number((bike as {odometerKm?:number}|null)?.odometerKm||0);
 for(const p of plans){
  const status=maintenanceStatus(p as unknown as {label:string;intervalKm?:number;intervalDays?:number;lastServiceKm?:number;lastServiceOn?:string;enabled?:boolean},km,today);
  if(status.status==='due'||status.status==='soon')alerts.push({id:`maintenance-${p._id}`,level:status.status==='due'?'warning':'info',
   title:`Manutenção ${status.status==='due'?'prevista ou vencida':'próxima'}: ${p.label}`,
   description:[status.daysRemaining!==null?`${status.daysRemaining} dia(s)`:null,status.kmRemaining!==null?`${status.kmRemaining} km`:null].filter(Boolean).join(' · '),href:'/app/moto',dueOn:status.nextOn||undefined});
 }
 for(const p of manualReminders){
   const overdueDate=!!p.dueOn&&p.dueOn<=today;
   const soonDate=!!p.dueOn&&p.dueOn<=addDays(today,7);
   const kmThreshold=p.dueKm!==undefined&&p.dueKm!==null&&Number(p.dueKm)-km<=500;
   if(overdueDate||soonDate||kmThreshold)alerts.push({id:`reminder-${p._id}`,level:overdueDate?'warning':'info',title:`Lembrete: ${p.label}`,
     description:p.dueOn?`Previsão: ${p.dueOn}`:p.dueKm!==undefined?`Quilometragem prevista: ${p.dueKm}`:'',href:'/app/moto',dueOn:p.dueOn||undefined});
 }
 for(const r of recurrences){
   if(postedIds.has(String(r._id)))continue;
   const due=nextPaymentDate(Number(r.dayOfMonth),String(r.startMonth),today);
   const days=daysUntil(today,due);
   if(days<=7)alerts.push({id:`recurrence-${r._id}`,level:'info',title:`Despesa recorrente: ${r.label}`,
    description:`R$ ${(Number(r.amountCents)/100).toFixed(2).replace('.',',')} programados para ${due}. O registro ocorre ao acessar o aplicativo na data prevista ou depois.`,href:'/app/recorrentes',dueOn:due});
 }
 const sorted=alerts.sort((a,b)=>Number(b.level==='warning')-Number(a.level==='warning')||String(a.dueOn||'').localeCompare(String(b.dueOn||''))).slice(0,20);
 res.setHeader('Cache-Control','private, no-store');
 res.json({today,count:alerts.length,items:sorted,truncated:alerts.length>sorted.length});
}));
