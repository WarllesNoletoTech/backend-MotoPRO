import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import mongoose from 'mongoose';
import {AdminAudit} from '../models/AdminAudit.js';
import {OneSignalDevice} from '../models/OneSignalDevice.js';
import {PushSubscription} from '../models/PushSubscription.js';
import {NotificationSetting,notificationKinds,getNotificationSettings} from '../models/NotificationSetting.js';
import {oneSignalAppId,oneSignalSendingReady,sendOneSignalNotice} from '../services/oneSignal.js';
import {pushConfigured,sendWebPush} from '../services/webPush.js';
import {categoryUrls,type PushMessage} from '../services/notificationMessages.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';

export const adminNotificationsRouter=Router();
const template=z.object({title:z.string().trim().min(4).max(75),body:z.string().trim().min(10).max(180)}).strict();
const category=z.enum(notificationKinds);
const settingsSchema=z.object({
 enabled:z.boolean(),
 categories:z.object({maintenance:z.boolean(),recurring:z.boolean(),receivables:z.boolean(),subscription:z.boolean()}).strict(),
 templates:z.object({summary:template,maintenance:template,recurring:template,receivables:template,subscription:template}).strict()
}).strict();
const testSchema=z.object({category, ...template.shape}).strict();
const testLimit=rateLimit({windowMs:15*60_000,limit:3,standardHeaders:'draft-7',legacyHeaders:false,
 message:{error:'Limite de 3 testes a cada 15 minutos. Aguarde antes de testar novamente.'}});

adminNotificationsRouter.get('/notifications',asyncRoute(async(req,res)=>{
 const adminId=uid(req);
 const isOneSignal=Boolean(oneSignalAppId());
 const [settings,myDevices,totalDevices]=await Promise.all([
  getNotificationSettings(),
  isOneSignal?OneSignalDevice.countDocuments({userId:adminId,enabled:true}):PushSubscription.countDocuments({userId:adminId,enabled:true}),
  isOneSignal?OneSignalDevice.countDocuments({enabled:true}):PushSubscription.countDocuments({enabled:true})
 ]);
 res.setHeader('Cache-Control','private, no-store');
 res.json({settings,provider:isOneSignal?'onesignal':pushConfigured()?'vapid':'none',
  providerReady:isOneSignal?oneSignalSendingReady():pushConfigured(),
  myDevices,totalDevices,missingConfiguration:isOneSignal&&!oneSignalSendingReady()?'Configure ONESIGNAL_REST_API_KEY no Heroku':null,
  note:'O teste é direcionado somente à conta do administrador e requer consentimento no dispositivo. O serviço aceita o envio, mas não garante exibição pelo celular.'});
}));

adminNotificationsRouter.patch('/notifications',asyncRoute(async(req,res)=>{
 const data=settingsSchema.parse(req.body);
 await NotificationSetting.findOneAndUpdate({key:'global'},{$set:{enabled:data.enabled,categories:data.categories,templates:data.templates}},
  {new:true,upsert:true,runValidators:true,setDefaultsOnInsert:true});
 await AdminAudit.create({actorId:new mongoose.Types.ObjectId(uid(req)),action:'notifications.settings',
  metadata:{enabled:data.enabled,maintenance:data.categories.maintenance,recurring:data.categories.recurring,
   receivables:data.categories.receivables,subscription:data.categories.subscription}});
 res.setHeader('Cache-Control','no-store');
 res.json({ok:true,settings:await getNotificationSettings()});
}));

/** Somente o administrador autenticado; nunca envia para todos os motoboys. */
adminNotificationsRouter.post('/notifications/test',testLimit,asyncRoute(async(req,res)=>{
 const input=testSchema.parse(req.body);
 const adminId=uid(req);
 const msg:PushMessage={category:'test',title:input.title,body:input.body,url:'/app/admin'};
 let providerId:string|null=null;
 let deliveredTo=0;
 if(oneSignalAppId()){
  if(!oneSignalSendingReady())throw new HttpError(503,'Configure ONESIGNAL_REST_API_KEY e ONESIGNAL_APP_ID no Heroku');
  const devices=await OneSignalDevice.find({userId:adminId,enabled:true}).select('subscriptionId').limit(10).lean();
  const ids=devices.map(v=>String(v.subscriptionId));
  if(!ids.length)throw new HttpError(409,'Ative notificações neste aparelho do administrador antes de testar.');
  // Links fixos do aplicativo; título e texto validados, nenhuma URL arbitrária.
  msg.url=categoryUrls[input.category];
  const result=await sendOneSignalNotice(ids,msg);
  providerId=result.id;deliveredTo=ids.length;
 }else if(pushConfigured()){
  const devices=await PushSubscription.find({userId:adminId,enabled:true}).limit(10);
  if(!devices.length)throw new HttpError(409,'Ative notificações neste aparelho do administrador antes de testar.');
  for(const device of devices){
   try{
    const response=await sendWebPush(device,msg);
    if(response.expired){await PushSubscription.deleteOne({_id:device._id});continue;}
    deliveredTo++;
   }catch{/* Alguns aparelhos podem estar offline: testar os outros sem vazar os endpoints. */}
  }
  if(!deliveredTo)throw new HttpError(502,'Nenhum provedor aceitou o teste. Verifique o aparelho e a configuração de push.');
 }else throw new HttpError(503,'Configure OneSignal (App ID + REST API Key) ou Web Push VAPID antes de testar.');
 await AdminAudit.create({actorId:new mongoose.Types.ObjectId(adminId),action:'notifications.test',
  metadata:{category:input.category,provider:oneSignalAppId()?'onesignal':'vapid',deviceCount:deliveredTo}});
 res.setHeader('Cache-Control','private, no-store');
 res.json({ok:true,provider:oneSignalAppId()?'onesignal':'vapid',acceptedDevices:deliveredTo,providerId,
  message:'Teste aceito pelo provedor. A exibição depende do aparelho, da permissão e da conexão.'});
}));
