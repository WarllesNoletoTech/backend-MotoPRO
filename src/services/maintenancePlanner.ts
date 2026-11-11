import {addDays,isValidDateOnly} from '../utils/dates.js';
export type Plan={label:string;intervalKm?:number;intervalDays?:number;lastServiceKm?:number;lastServiceOn?:string;enabled?:boolean};
export function maintenanceStatus(plan:Plan,currentKm:number,today:string){
 const nextKm=plan.intervalKm!==undefined && plan.lastServiceKm!==undefined?plan.lastServiceKm+plan.intervalKm:null;
 const nextOn=plan.intervalDays!==undefined && plan.lastServiceOn && isValidDateOnly(plan.lastServiceOn)?addDays(plan.lastServiceOn,plan.intervalDays):null;
 const kmRemaining=nextKm===null?null:Math.round(nextKm-currentKm);
 const daysRemaining=nextOn?Math.round((Date.parse(nextOn+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000):null;
 const status=plan.enabled===false?'paused':(kmRemaining!==null&&kmRemaining<=0)||(daysRemaining!==null&&daysRemaining<=0)?'due':
  (kmRemaining!==null&&kmRemaining<=500)||(daysRemaining!==null&&daysRemaining<=7)?'soon':'ok';
 return {nextKm,nextOn,kmRemaining,daysRemaining,status};
}
