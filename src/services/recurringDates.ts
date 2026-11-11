import {addDays} from '../utils/dates.js';

export const validMonth=(s:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s)&&Number(s.slice(0,4))>=2000&&Number(s.slice(0,4))<=2100;
export function nextMonth(month:string):string{
 if(!validMonth(month))throw new Error('Mês inválido');
 const [year,m]=month.split('-').map(Number);
 return `${year+(m===12?1:0)}-${String(m===12?1:m+1).padStart(2,'0')}`;
}
export function monthDueDate(month:string,dayOfMonth:number):string{
 if(!validMonth(month)||!Number.isInteger(dayOfMonth)||dayOfMonth<1||dayOfMonth>31)throw new Error('Recorrência inválida');
 const [year,m]=month.split('-').map(Number);
 const last=new Date(Date.UTC(year,m,0)).getUTCDate();
 return `${month}-${String(Math.min(dayOfMonth,last)).padStart(2,'0')}`;
}
export function nextPaymentDate(dayOfMonth:number,startMonth:string,today:string):string{
 const current=today.slice(0,7);
 let month=startMonth>current?startMonth:current;
 let due=monthDueDate(month,dayOfMonth);
 if(due<today)due=monthDueDate(nextMonth(month),dayOfMonth);
 return due;
}
export function daysUntil(from:string,to:string){
 return Math.round((Date.parse(to+'T00:00:00.000Z')-Date.parse(from+'T00:00:00.000Z'))/86400000);
}
