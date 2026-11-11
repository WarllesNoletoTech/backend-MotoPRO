import {RecurringExpense} from '../models/RecurringExpense.js';
import {Entry} from '../models/Entry.js';
import {User} from '../models/User.js';
import {dateInTimezone} from '../utils/dates.js';
import {monthDueDate} from './recurringDates.js';

// Só contabiliza a competência atual quando o usuário abre o aplicativo.
// Não existe cobrança externa nem lançamento retroativo de meses anteriores.
export async function syncRecurringExpenses(userId:string):Promise<{created:number;checked:number;month:string}> {
 const user=(await User.findById(userId).select('timezone role').lean()) as unknown as {timezone?:string;role?:string}|null;
 if(!user)throw new Error('Usuário não encontrado');
 if(user.role!=='driver')return {created:0,checked:0,month:dateInTimezone(user.timezone||'America/Belem').slice(0,7)};
 const today=dateInTimezone(user.timezone||'America/Belem');
 const month=today.slice(0,7);
 const rules=await RecurringExpense.find({userId,enabled:true,startMonth:{$lte:month}}).limit(30).lean();
 let created=0,checked=0;
 for(const rule of rules){
  const dueOn=monthDueDate(month,Number(rule.dayOfMonth));
  if(dueOn>today)continue;
  checked++;
  try{
   const result=await Entry.updateOne(
    {userId,recurrenceId:rule._id,recurrenceMonth:month},
    {$setOnInsert:{userId,type:'expense',category:rule.category,description:String(rule.label),
      amountCents:rule.amountCents,occurredOn:dueOn,source:'recurring',recurrenceId:rule._id,recurrenceMonth:month}},
    {upsert:true,runValidators:true}
   );
   created+=result.upsertedCount||0;
  }catch(err){
   if(!(typeof err==='object'&&err&&'code'in err&&err.code===11000))throw err;
  }
 }
 return {created,checked,month};
}
