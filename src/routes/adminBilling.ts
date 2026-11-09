import {Router} from 'express';
import {BillingPayment} from '../models/BillingPayment.js';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {User} from '../models/User.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';
export const adminBillingRouter=Router();
adminBillingRouter.use(asyncRoute(async(req,_res,next)=>{
 const user=await User.findById(uid(req)).select('role');
 if(user?.role!=='admin')throw new HttpError(403,'Acesso restrito à administração');
 next();
}));
adminBillingRouter.get('/overview',asyncRoute(async(_req,res)=>{
 const [users,active,approved]=await Promise.all([
  User.countDocuments(),BillingSubscription.countDocuments({status:'active',activeUntil:{$gt:new Date()}}),
  BillingPayment.aggregate<{_id:null;sum:number;count:number}>([{$match:{status:'approved'}},{$group:{_id:null,sum:{$sum:'$amountCents'},count:{$sum:1}}}])
 ]);
 res.json({users,activeSubscribers:active,receivedCents:approved[0]?.sum||0,approvedPayments:approved[0]?.count||0,weeklyPriceCents:999,monthlyCampaign:{status:'planning',message:'Divulgação e regulamento da premiação em preparação; nenhuma seleção ou sorteio é realizado pelo sistema.'}});
}));
