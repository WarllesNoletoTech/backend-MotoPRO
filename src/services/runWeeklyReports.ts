import {User} from '../models/User.js';
import {Entry} from '../models/Entry.js';
import {ReportEmailPreference} from '../models/ReportEmailPreference.js';
import {WeeklyReportDelivery} from '../models/WeeklyReportDelivery.js';
import {financialSummary} from '../routes/dashboard.js';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {CourtesyGrant} from '../models/CourtesyGrant.js';
import {getAdminSettings} from '../models/AdminSetting.js';
import {subscriptionNotice} from '../utils/subscriptionLifecycle.js';
import {premiumAccessFor,currentTrialUntil} from './premiumPolicy.js';
import {nameParts} from '../utils/name.js';
import {dateInTimezone} from '../utils/dates.js';
import {isReportWindowOpen,lastClosedWeek,reportEmailConfigured,sendReportEmail,weeklyEmailText} from './reportEmail.js';

/** Executado somente pelo agendador, nunca por rota pública. Não envia sem consentimento confirmado. */
export async function runWeeklyReports(maxEmails=80,instant=new Date()){
 if(!reportEmailConfigured())throw new Error('Configure RESEND_API_KEY e REPORTS_FROM_EMAIL antes de executar o agendador.');
 const max=Math.max(1,Math.min(200,Math.floor(maxEmails)));
 const cutoff=new Date(instant.getTime()-30*60_000);
 const stats={scanned:0,sent:0,failed:0,skipped:0};
 await Promise.all([WeeklyReportDelivery.init(),ReportEmailPreference.init()]);
 const settings=await getAdminSettings();
 const cursor=ReportEmailPreference.find({enabled:true,verifiedAt:{$ne:null}}).cursor();
 for await(const pref of cursor){
  if(stats.sent+stats.failed>=max)break;
  stats.scanned++;
  const user=(await User.findById(pref.userId).select('email name role blockedAt timezone createdAt phone').lean()) as unknown as {
   _id:unknown;email:string;name:string;role:string;blockedAt:Date|null;timezone:string|null;createdAt:Date|null;phone:string|null
  }|null;
  if(!user||user.role!=='driver'||user.blockedAt||user.email!==pref.email){stats.skipped++;continue;}
  if(!user.phone||!nameParts(user.name).complete){stats.skipped++;continue;}
  const [sub,courtesy]=await Promise.all([
   BillingSubscription.findOne({userId:user._id}).select('activeUntil status').lean(),
   CourtesyGrant.findOne({userId:user._id,activeUntil:{$gt:instant}}).select('activeUntil').lean()
  ]);
  const notice=subscriptionNotice({paidUntil:sub?.activeUntil,trialUntil:currentTrialUntil(user.createdAt,settings.trialDays),courtesyUntil:courtesy?.activeUntil},instant);
  if(!premiumAccessFor(notice.status,true,false).allowed){stats.skipped++;continue;}
  const timezone=user.timezone||'America/Belem';
  if(!isReportWindowOpen(instant,timezone)){stats.skipped++;continue;}
  const {from,to}=lastClosedWeek(dateInTimezone(timezone,instant));
  const record=await WeeklyReportDelivery.findOneAndUpdate({userId:user._id,periodFrom:from},
   {$setOnInsert:{userId:user._id,periodFrom:from,periodTo:to,status:'pending'}},
   {upsert:true,new:true});
  const claim=await WeeklyReportDelivery.findOneAndUpdate({_id:record._id,
   $or:[{status:'pending'},{status:'failed',attempts:{$lt:3}},
     {status:'sending',claimedAt:{$lt:cutoff},attempts:{$lt:3}}]},
   {$set:{status:'sending',claimedAt:instant,lastError:null},$inc:{attempts:1}},{new:true});
  if(!claim){stats.skipped++;continue;}
  try{
   const [summary,entriesCount,integratedCount]=await Promise.all([
    financialSummary(String(user._id),from,to),
    Entry.countDocuments({userId:user._id,occurredOn:{$gte:from,$lte:to}}),
    Entry.countDocuments({userId:user._id,occurredOn:{$gte:from,$lte:to},source:'integration'})
   ]);
   // Checagem de consentimento novamente antes de transmitir informações financeiras.
   const enabled=await ReportEmailPreference.exists({userId:user._id,email:user.email,enabled:true,verifiedAt:{$ne:null}});
   if(!enabled){await WeeklyReportDelivery.updateOne({_id:claim._id},{$set:{status:'pending',claimedAt:null}});stats.skipped++;continue;}
   const messageId=await sendReportEmail(user.email,`MotoPRO · Fechamento ${from} a ${to}`,
    weeklyEmailText({name:user.name,from,to,entriesCount,integratedCount,...summary}),
    `motopro-weekly-${String(user._id)}-${from}`);
   await WeeklyReportDelivery.updateOne({_id:claim._id},{$set:{status:'sent',sentAt:new Date(),providerMessageId:messageId,lastError:null}});
   stats.sent++;
  }catch(err){
   const safeMessage=err instanceof Error?err.message:'Falha não identificada';
   await WeeklyReportDelivery.updateOne({_id:claim._id},{$set:{status:'failed',lastError:safeMessage.slice(0,180)}});
   stats.failed++;
  }
 }
 await cursor.close();
 return stats;
}
