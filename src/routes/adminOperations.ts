import {Router} from 'express';
import {OperationalEvent} from '../models/OperationalEvent.js';
import {PushSubscription} from '../models/PushSubscription.js';
import {PushDelivery} from '../models/PushDelivery.js';
import {OneSignalDevice} from '../models/OneSignalDevice.js';
import {oneSignalAppId,oneSignalSendingReady} from '../services/oneSignal.js';
import {pushConfigured} from '../services/webPush.js';
import {asyncRoute} from '../utils/http.js';
export const adminOperationsRouter=Router();
// Usar somente depois do middleware administrativo de /api/admin/billing.
adminOperationsRouter.get('/operations',asyncRoute(async(_req,res)=>{
 const now=new Date();const day=new Date(now.getTime()-86400_000);
 const week=new Date(now.getTime()-7*86400_000);
 const [events,failures24h,slow24h,devices,delivered7d,failedPush7d]=await Promise.all([
  OperationalEvent.find({at:{$gte:day}}).sort({at:-1}).limit(40).lean(),
  OperationalEvent.countDocuments({at:{$gte:day},kind:'error'}),
  OperationalEvent.countDocuments({at:{$gte:day},kind:'slow'}),
  oneSignalAppId()?OneSignalDevice.countDocuments({enabled:true}):PushSubscription.countDocuments({enabled:true}),
  PushDelivery.countDocuments({status:'sent',sentAt:{$gte:week}}),
  PushDelivery.countDocuments({status:'failed',updatedAt:{$gte:week}})
 ]);
 res.setHeader('Cache-Control','private, no-store');
 res.json({checkedAt:now,trackedErrors24h:failures24h,trackedSlow24h:slow24h,
  pushConfigured:oneSignalAppId()?oneSignalSendingReady():pushConfigured(),pushProvider:oneSignalAppId()?'onesignal':'vapid',pushActiveDevices:devices,pushDelivered7d:delivered7d,pushFailed7d:failedPush7d,
  recent:events.map(e=>({kind:e.kind,status:e.status,method:e.method,route:e.route,durationMs:e.durationMs,requestId:e.requestId,at:e.at})),
  notes:['São registrados apenas erros HTTP 5xx e requisições lentas (2,5s ou mais); não é uma taxa de erro de todas as requisições.',
   'Monitoramento tem retenção de 7 dias e depende da conexão com o MongoDB. Sem envio a serviço externo.',
   'Push depende do consentimento do usuário e do agendamento diário no Heroku. OneSignal requer App ID e REST API Key; Web Push próprio requer VAPID.']});
}));
