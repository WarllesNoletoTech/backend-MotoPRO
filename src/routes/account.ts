import {Router} from 'express';
import mongoose from 'mongoose';
import {User} from '../models/User.js';
import {Entry} from '../models/Entry.js';
import {Motorcycle} from '../models/Motorcycle.js';
import {Maintenance} from '../models/Maintenance.js';
import {MaintenancePlan} from '../models/MaintenancePlan.js';
import {ReceiptAnalysis} from '../models/ReceiptAnalysis.js';
import {AiUsage} from '../models/AiUsage.js';
import {Goal} from '../models/Goal.js';
import {ReportEmailPreference} from '../models/ReportEmailPreference.js';
import {WeeklyReportDelivery} from '../models/WeeklyReportDelivery.js';
import {BillingPayment} from '../models/BillingPayment.js';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {PrivateCustomer} from '../models/PrivateCustomer.js';
import {PrivateDelivery} from '../models/PrivateDelivery.js';
import {RecurringExpense} from '../models/RecurringExpense.js';
import {PrivacyRequest} from '../models/PrivacyRequest.js';
import {PushSubscription} from '../models/PushSubscription.js';
import {uid} from '../services/auth.js';
import {getAdminSettings} from '../models/AdminSetting.js';
import {currentTrialUntil} from '../services/premiumPolicy.js';
import {asyncRoute,HttpError} from '../utils/http.js';

/** Exportação dos próprios dados, independente do plano. Nunca exporta senha, JWT, tokens ou código Pix. */
export const accountRouter=Router();
accountRouter.get('/export',asyncRoute(async(req,res)=>{
 const userId=new mongoose.Types.ObjectId(uid(req));
 const [user,entries,motorcycle,reminders,goal,subscription,payments,settings,reportEmailPreference,reportDeliveries,maintenancePlans,receiptAnalyses,aiUsage,privateCustomers,privateDeliveries,recurringExpenses,privacyRequests,pushDevices]=await Promise.all([
   User.findById(userId).select('name email phone role timezone trialEndsAt createdAt').lean(),
   Entry.find({userId}).select('type category description amountCents occurredOn source platform provider externalId fuelLiters odometerKm fuelType fuelStation createdAt').sort({occurredOn:-1}).lean(),
   Motorcycle.findOne({userId}).select('model year odometerKm kmPerLiter').lean(),
   Maintenance.find({userId}).select('label dueOn dueKm done createdAt').lean(),
   Goal.findOne({userId}).select('weeklyTargetCents monthlyTargetCents').lean(),
   BillingSubscription.findOne({userId}).select('method status priceCents activeUntil cancelAtPeriodEnd').lean(),
   BillingPayment.find({userId}).select('method status amountCents paidAt createdAt').sort({createdAt:-1}).lean(),
   getAdminSettings(),
   ReportEmailPreference.findOne({userId}).select('email enabled verifiedAt createdAt updatedAt').lean(),
   WeeklyReportDelivery.find({userId}).select('periodFrom periodTo status sentAt attempts').sort({periodFrom:-1}).lean(),
   MaintenancePlan.find({userId}).select('label intervalKm intervalDays lastServiceKm lastServiceOn enabled lastCompletedAt createdAt').lean(),
   ReceiptAnalysis.find({userId}).select('suggestion confirmedEntryId createdAt').lean(),
   AiUsage.find({userId}).select('feature outcome model inputTokens outputTokens estimatedUsd createdAt').sort({createdAt:-1}).limit(5000).lean(),
   PrivateCustomer.find({userId}).select('name phone notes archived createdAt').lean(),
   PrivateDelivery.find({userId}).select('customerId description deliveredOn amountCents createdAt').lean(),
   RecurringExpense.find({userId}).select('label category amountCents dayOfMonth startMonth enabled createdAt').lean(),
   PrivacyRequest.find({userId}).select('type note status response createdAt resolvedAt').lean(),
   PushSubscription.countDocuments({userId,enabled:true})
 ]);
 if(!user)throw new HttpError(401,'Conta não encontrada');
 // findById sempre retorna um único documento, nunca uma lista. A tipagem genérica
 // do modelo legado faz o lean() aparentar retornar também um array no TypeScript.
 const createdAt=(user as unknown as {createdAt?:Date|null}).createdAt;
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Content-Disposition','attachment; filename="motopro-meus-dados.json"');
 res.json({exportedAt:new Date().toISOString(),user:{...user,trialEndsAt:currentTrialUntil(createdAt,settings.trialDays)},entries,motorcycle,reminders,goal,subscription,payments,reportEmailPreference,reportDeliveries,maintenancePlans,receiptAnalyses,aiUsage,privateCustomers,privateDeliveries,recurringExpenses,privacyRequests,pushDevices});
}));
