import {PushDelivery} from '../models/PushDelivery.js';
import {PushSubscription} from '../models/PushSubscription.js';
import {User} from '../models/User.js';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {CourtesyGrant} from '../models/CourtesyGrant.js';
import {getAdminSettings} from '../models/AdminSetting.js';
import {getUserAlerts} from './alertCenter.js';
import {sendWebPush,pushConfigured} from './webPush.js';
import {currentTrialUntil,premiumAccessFor} from './premiumPolicy.js';
import {subscriptionNotice} from '../utils/subscriptionLifecycle.js';
import {nameParts} from '../utils/name.js';
/** Execução diária pelo Heroku Scheduler, nunca a partir de uma rota pública. */
export async function runDailyPush(maxUsers=150,instant=new Date()){
 if(!pushConfigured())throw new Error('Configure PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY e PUSH_CONTACT_EMAIL');
 const stats={scanned:0,sent:0,failed:0,skipped:0};
 const max=Math.max(1,Math.min(500,Math.floor(maxUsers)));
 const settings=await getAdminSettings();
 await Promise.all([PushDelivery.init(),PushSubscription.init()]);
 // Iterar usuários distintos para evitar múltiplas notificações do mesmo dia.
 const userIds=await PushSubscription.distinct('userId',{enabled:true});
 for(const id of userIds){
  if(stats.sent+stats.failed>=max)break;
  stats.scanned++;
  const user=(await User.findById(id).select('role blockedAt createdAt name timezone phone').lean()) as unknown as {
   role:string;blockedAt:Date|null;createdAt:Date;name:string;timezone?:string;phone?:string
  }|null;
  if(!user||user.role!=='driver'||user.blockedAt||!nameParts(user.name).complete||!user.phone){stats.skipped++;continue;}
  const [sub,courtesy]=await Promise.all([
   BillingSubscription.findOne({userId:id}).select('activeUntil').lean(),
   CourtesyGrant.findOne({userId:id,activeUntil:{$gt:instant}}).select('activeUntil').lean()
  ]);
  const notice=subscriptionNotice({paidUntil:sub?.activeUntil,courtesyUntil:courtesy?.activeUntil,trialUntil:currentTrialUntil(user.createdAt,settings.trialDays)},instant);
  if(!premiumAccessFor(notice.status,true,false).allowed){stats.skipped++;continue;}
  const alerts=await getUserAlerts(String(id));
  if(!alerts || !alerts.count){stats.skipped++;continue;}
  const date=alerts.today;
  const existing=await PushDelivery.findOneAndUpdate({userId:id,date},{$setOnInsert:{userId:id,date,status:'pending'}},{upsert:true,new:true});
  const claimed=await PushDelivery.findOneAndUpdate({_id:existing._id,$or:[{status:'pending'},{status:'failed',attempts:{$lt:3}},
   {status:'sending',claimedAt:{$lt:new Date(instant.getTime()-30*60_000)},attempts:{$lt:3}}]},
   {$set:{status:'sending',claimedAt:instant,count:alerts.count},$inc:{attempts:1}},{new:true});
  if(!claimed){stats.skipped++;continue;}
  try{
   const devices=await PushSubscription.find({userId:id,enabled:true}).limit(10);
   if(!devices.length){await PushDelivery.deleteOne({_id:claimed._id});stats.skipped++;continue;}
   let sent=0;
   for(const device of devices){
    try{
     // Conteúdo genérico evita expor movimentações financeiras na tela de bloqueio.
     const result=await sendWebPush(device,{title:'MotoPRO · Avisos',body:`Você tem ${alerts.count} aviso(s) para conferir no aplicativo.`,url:'/app/avisos'});
     if(result.expired){await PushSubscription.deleteOne({_id:device._id});continue;}
     await PushSubscription.updateOne({_id:device._id},{$set:{lastSentAt:instant,lastError:null}});sent++;
    }catch(e){
     await PushSubscription.updateOne({_id:device._id},{$set:{lastError:e instanceof Error?e.message.slice(0,80):'Erro de entrega'}});
    }
   }
   if(!sent)throw new Error('Nenhum dispositivo recebeu a notificação');
   await PushDelivery.updateOne({_id:claimed._id},{$set:{status:'sent',sentAt:instant}});stats.sent++;
  }catch{
   await PushDelivery.updateOne({_id:claimed._id},{$set:{status:'failed'}});stats.failed++;
  }
 }
 return stats;
}
