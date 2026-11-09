import {Router} from 'express';
import mongoose from 'mongoose';
import {User} from '../models/User.js';
import {Entry} from '../models/Entry.js';
import {Motorcycle} from '../models/Motorcycle.js';
import {Maintenance} from '../models/Maintenance.js';
import {Goal} from '../models/Goal.js';
import {BillingPayment} from '../models/BillingPayment.js';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';

/** Exportação dos próprios dados, independente do plano. Nunca exporta senha, JWT, tokens ou código Pix. */
export const accountRouter=Router();
accountRouter.get('/export',asyncRoute(async(req,res)=>{
 const userId=new mongoose.Types.ObjectId(uid(req));
 const [user,entries,motorcycle,reminders,goal,subscription,payments]=await Promise.all([
   User.findById(userId).select('name email role timezone trialEndsAt createdAt').lean(),
   Entry.find({userId}).select('type category description amountCents occurredOn source fuelLiters odometerKm createdAt').sort({occurredOn:-1}).lean(),
   Motorcycle.findOne({userId}).select('model year odometerKm kmPerLiter').lean(),
   Maintenance.find({userId}).select('label dueOn dueKm done createdAt').lean(),
   Goal.findOne({userId}).select('weeklyTargetCents').lean(),
   BillingSubscription.findOne({userId}).select('method status priceCents activeUntil cancelAtPeriodEnd').lean(),
   BillingPayment.find({userId}).select('method status amountCents paidAt createdAt').sort({createdAt:-1}).lean()
 ]);
 if(!user)throw new HttpError(401,'Conta não encontrada');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Content-Disposition','attachment; filename="motopro-meus-dados.json"');
 res.json({exportedAt:new Date().toISOString(),user,entries,motorcycle,reminders,goal,subscription,payments});
}));
