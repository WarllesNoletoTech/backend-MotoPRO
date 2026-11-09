import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import {BillingPayment} from '../models/BillingPayment.js';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {User} from '../models/User.js';
import {getAdminSettings} from '../models/AdminSetting.js';
import {CourtesyGrant} from '../models/CourtesyGrant.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {mp,mpPix,paymentConfig,pixPaymentConfig,MpPixOrder,MpSubscription} from '../services/mercadoPago.js';
import {syncPixPayment,syncPixOrder,syncCreditSubscription} from '../services/billing.js';

export const billingRouter=Router();
const makePlan=(priceCents:number)=>({priceCents,currency:'BRL',frequency:7,frequencyUnit:'days',methods:['pix','credit'] as const,pixAutomaticAvailable:false});
billingRouter.get('/plan',asyncRoute(async(_req,res)=>res.json({plan:makePlan((await getAdminSettings()).weeklyPriceCents),billingEnabled:paymentConfig().enabled||pixPaymentConfig().enabled})));
billingRouter.get('/me',asyncRoute(async(req,res)=>{
 const userId=new mongoose.Types.ObjectId(uid(req));
 const sub=await BillingSubscription.findOne({userId}).lean();
 const payment=await BillingPayment.findOne({userId,method:'pix',status:'pending'}).sort({createdAt:-1}).lean();
 const active=!!sub?.activeUntil && new Date(sub.activeUntil)>new Date();
 const [settings,courtesy]=await Promise.all([getAdminSettings(),CourtesyGrant.findOne({userId,activeUntil:{$gt:new Date()}}).select('activeUntil').lean()]);
 res.json({plan:makePlan(settings.weeklyPriceCents),courtesyUntil:courtesy?.activeUntil??null,billingEnabled:paymentConfig().enabled||pixPaymentConfig().enabled,subscription:sub?{method:sub.method,status:sub.status,activeUntil:sub.activeUntil,cancelAtPeriodEnd:sub.cancelAtPeriodEnd,active}:null,pendingPix:payment?{id:String(payment._id),code:payment.pixCode,qrCodeBase64:payment.pixQrBase64,ticketUrl:payment.pixTicketUrl,expiresAt:payment.expiresAt}:null});
}));
billingRouter.post('/pix',asyncRoute(async(req,res)=>{
 if(!pixPaymentConfig().enabled)throw new HttpError(503,'Pix de teste ainda não configurado');
 const userId=new mongoose.Types.ObjectId(uid(req));
 const user=await User.findById(userId).select('email');if(!user)throw new HttpError(401,'Conta inválida');
 const recurring=await BillingSubscription.findOne({userId,method:'credit',providerSubscriptionId:{$exists:true},cancelAtPeriodEnd:false});
 if(recurring)throw new HttpError(409,'Cancele sua assinatura automática antes de utilizar Pix avulso');
 const expires=new Date(Date.now()+30*60*1000);
 const existing=await BillingPayment.findOne({userId,method:'pix',status:'pending',expiresAt:{$gt:new Date()}}).sort({createdAt:-1});
 if(existing?.pixCode)return res.json({paymentId:String(existing._id),pixCode:existing.pixCode,qrCodeBase64:existing.pixQrBase64,ticketUrl:existing.pixTicketUrl,expiresAt:existing.expiresAt});
 const priceCents=(await getAdminSettings()).weeklyPriceCents;
 // Reaproveita a mesma chave de idempotência se a chamada anterior tiver falhado/expirado no transporte.
 const pay=existing??await BillingPayment.create({userId,method:'pix',status:'pending',amountCents:priceCents,idempotencyKey:randomUUID(),expiresAt:expires});
 const amount=(pay.amountCents/100).toFixed(2);
 const order=pay.providerOrderId
  ? await mpPix<MpPixOrder>('GET',`/v1/orders/${encodeURIComponent(pay.providerOrderId)}`)
  : await mpPix<MpPixOrder>('POST','/v1/orders',{
   type:'online',total_amount:amount,external_reference:`motopro_pix_${String(pay._id)}`,
   processing_mode:'automatic',
   transactions:{payments:[{amount,payment_method:{id:'pix',type:'bank_transfer'},expiration_time:'PT30M'}]},
   payer:{email:user.email}
  },pay.idempotencyKey);
 if(!order.id || !/^ORD[0-9A-Za-z]+$/.test(order.id))throw new HttpError(502,'Mercado Pago não retornou uma order válida');
 if(order.external_reference!==`motopro_pix_${String(pay._id)}`)throw new HttpError(502,'Referência da cobrança Pix divergente');
 pay.providerOrderId=order.id;
 const pix=order.transactions?.payments?.[0]?.payment_method;
 if(pix?.id==='pix'){
  pay.pixCode=pix.qr_code;pay.pixQrBase64=pix.qr_code_base64;pay.pixTicketUrl=pix.ticket_url;
 }
 await pay.save();
 if(!pay.pixCode)throw new HttpError(503,'Pix ainda em processamento. Use Verificar confirmação em instantes.');
 res.status(201).json({paymentId:String(pay._id),pixCode:pay.pixCode,qrCodeBase64:pay.pixQrBase64,ticketUrl:pay.pixTicketUrl,expiresAt:pay.expiresAt});
}));
billingRouter.post('/credit',asyncRoute(async(req,res)=>{
 const cfg=paymentConfig();if(!cfg.enabled)throw new HttpError(503,'Pagamentos ainda em homologação');
 const userId=new mongoose.Types.ObjectId(uid(req));
 const user=await User.findById(userId).select('email');if(!user)throw new HttpError(401,'Conta inválida');
 const old=await BillingSubscription.findOne({userId,method:'credit'});
 if(old?.providerSubscriptionId && !old.cancelAtPeriodEnd)throw new HttpError(409,'Já existe uma assinatura de cartão; verifique seu status ou cancele primeiro');
 const priceCents=(await getAdminSettings()).weeklyPriceCents;
 const result=await mp<MpSubscription&{init_point?:string}>('POST','/preapproval',{
  reason:`MotoPRO Premium - R$ ${(priceCents/100).toFixed(2).replace('.',',')} por semana`,payer_email:user.email,
  external_reference:`motopro_credit_${String(userId)}`,
  auto_recurring:{frequency:7,frequency_type:'days',transaction_amount:priceCents/100,currency_id:'BRL'},
  back_url:`${cfg.front}/app/assinatura`,status:'pending',
  notification_url:`${cfg.origin.replace(/\/$/,'')}/api/webhooks/mercadopago`
 });
 if(!result.id||!result.init_point)throw new HttpError(502,'Mercado Pago não retornou link de autorização');
 await BillingSubscription.findOneAndUpdate({userId},{$set:{method:'credit',status:'pending',priceCents,providerSubscriptionId:result.id,cancelAtPeriodEnd:false}},{upsert:true,new:true,runValidators:true});
 res.status(201).json({checkoutUrl:result.init_point});
}));
billingRouter.post('/refresh',asyncRoute(async(req,res)=>{
 const userId=new mongoose.Types.ObjectId(uid(req));
 const pay=await BillingPayment.findOne({userId,method:'pix',status:'pending'}).sort({createdAt:-1});
 if(pay?.providerOrderId)await syncPixOrder(pay.providerOrderId);
 else if(pay?.providerPaymentId)await syncPixPayment(pay.providerPaymentId);
 const sub=await BillingSubscription.findOne({userId,method:'credit'});
 if(sub?.providerSubscriptionId)await syncCreditSubscription(sub.providerSubscriptionId);
 res.json({ok:true});
}));
billingRouter.post('/cancel',asyncRoute(async(req,res)=>{
 const userId=new mongoose.Types.ObjectId(uid(req));
 const sub=await BillingSubscription.findOne({userId,method:'credit'});
 if(!sub?.providerSubscriptionId)throw new HttpError(404,'Nenhuma assinatura recorrente encontrada');
 if(!paymentConfig().enabled)throw new HttpError(503,'Integração de pagamento indisponível');
 await mp<MpSubscription>('PUT',`/preapproval/${encodeURIComponent(sub.providerSubscriptionId)}`,{status:'cancelled'});
 sub.cancelAtPeriodEnd=true;sub.status='canceled';await sub.save();
 res.json({ok:true,message:'Assinatura recorrente cancelada. O acesso pago permanece até o fim do período já confirmado.'});
}));
