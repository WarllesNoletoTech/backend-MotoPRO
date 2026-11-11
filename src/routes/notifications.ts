import {Router} from 'express';
import {z} from 'zod';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {publicPushKey,validatePushSubscription} from '../services/webPush.js';
import {PushSubscription} from '../models/PushSubscription.js';
import {User} from '../models/User.js';
export const notificationRouter=Router();
const schema=z.object({endpoint:z.string().max(1800),keys:z.object({p256dh:z.string().max(180),auth:z.string().max(120)}).strict()}).strict();
notificationRouter.get('/config',asyncRoute(async(req,res)=>{
 const id=uid(req);
 const count=await PushSubscription.countDocuments({userId:id,enabled:true});
 res.setHeader('Cache-Control','private, no-store');
 res.json({supported:!!publicPushKey(),publicKey:publicPushKey(),registeredDevices:count});
}));
notificationRouter.post('/subscribe',asyncRoute(async(req,res)=>{
 const data=schema.parse(req.body);validatePushSubscription(data);
 if(!publicPushKey())throw new HttpError(503,'Notificações ainda não configuradas no servidor');
 const user=(await User.findById(uid(req)).select('role blockedAt').lean()) as unknown as {_id:unknown;role:string;blockedAt:Date|null}|null;
 if(!user||user.role!=='driver'||user.blockedAt)throw new HttpError(403,'Conta sem permissão');
 await PushSubscription.findOneAndUpdate({endpoint:data.endpoint},{$set:{userId:user._id,keys:data.keys,enabled:true,lastError:null}},{upsert:true});
 res.setHeader('Cache-Control','no-store');res.json({ok:true});
}));
notificationRouter.post('/unsubscribe',asyncRoute(async(req,res)=>{
 const data=z.object({endpoint:z.string().min(1).max(1800)}).strict().parse(req.body);
 await PushSubscription.deleteOne({endpoint:data.endpoint,userId:uid(req)});
 res.json({ok:true});
}));
