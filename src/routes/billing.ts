import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import {BillingPayment} from '../models/BillingPayment.js';
import {BillingSubscription} from '../models/BillingSubscription.js';
import {User} from '../models/User.js';
import {getAdminSettings} from '../models/AdminSetting.js';
import {CourtesyGrant} from '../models/CourtesyGrant.js';
import {uid} from '../services/auth.js';
import {requireCompleteName} from '../services/completeName.js';
import {nameParts} from '../utils/name.js';
import {makePixOrderPayload} from '../services/pixOrderPayload.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {mp,mpPix,paymentConfig,pixPaymentConfig,MpPixOrder,MpSubscription} from '../services/mercadoPago.js';
import {syncPixPayment,syncPixOrder,syncCreditSubscription} from '../services/billing.js';
import {subscriptionNotice} from '../utils/subscriptionLifecycle.js';
import {premiumAccessFor,currentTrialUntil} from '../services/premiumPolicy.js';

export const billingRouter=Router();
const makePlan=(priceCents:number)=>({priceCents,currency:'BRL',frequency:7,frequencyUnit:'days',methods:['pix'] as const,pixAutomaticAvailable:false});
billingRouter.get('/plan',asyncRoute(async(_req,res)=>res.json({plan:makePlan((await getAdminSettings()).weeklyPriceCents),billingEnabled:pixPaymentConfig().enabled})));
billingRouter.get('/me',asyncRoute(async(req,res)=>{
 const userId=new mongoose.Types.ObjectId(uid(req));
 const [sub,payment,latestPix,settings,courtesy]=await Promise.all([
  BillingSubscription.findOne({userId}).lean(),
  BillingPayment.findOne({userId,method:'pix',status:'pending'}).sort({createdAt:-1}).lean(),
  BillingPayment.findOne({userId,method:'pix'}).sort({createdAt:-1}).select('_id status amountCents paidAt createdAt').lean(),
  getAdminSettings(),
  CourtesyGrant.findOne({userId,activeUntil:{$gt:new Date()}}).select('activeUntil').lean()
 ]);
 const now=new Date();
 // O prazo é autoridade; status gravado não pode manter uma assinatura expirada ativa.
 if(sub?.status==='active' && sub.activeUntil && new Date(sub.activeUntil)<=now){
  await BillingSubscription.updateOne({_id:sub._id,status:'active',activeUntil:{$lte:now}},{$set:{status:'expired'}});
 }
 // findById retorna um documento único; o model legado não tipa o .lean() corretamente.
 const user=(await User.findById(userId).select('createdAt role').lean()) as
  {createdAt?:Date|null;role?:'driver'|'admin'}|null;
 if(!user)throw new HttpError(401,'Conta não encontrada');
 const notice=subscriptionNotice({paidUntil:sub?.activeUntil,trialUntil:currentTrialUntil(user.createdAt,settings.trialDays),courtesyUntil:courtesy?.activeUntil},now);
 const active=!!sub?.activeUntil && new Date(sub.activeUntil)>now;
 res.setHeader('Cache-Control','private, no-store');
 res.json({
  contractVersion:2,trialDays:settings.trialDays,
  plan:makePlan(settings.weeklyPriceCents),courtesyUntil:courtesy?.activeUntil??null,
  billingEnabled:pixPaymentConfig().enabled,
  subscription:sub?{method:sub.method,status:active?sub.status:(sub.status==='active'?'expired':sub.status),activeUntil:sub.activeUntil,cancelAtPeriodEnd:sub.cancelAtPeriodEnd,active}:null,
  notice,renewalAllowed:notice.renewalAllowed,
  access:premiumAccessFor(notice.status,true,user.role==='admin'),
  pendingPix:payment?{id:String(payment._id),code:payment.pixCode,qrCodeBase64:payment.pixQrBase64,ticketUrl:payment.pixTicketUrl,expiresAt:payment.expiresAt}:null,
  // Estado obtido do MongoDB APÓS conciliação com o Mercado Pago, nunca do navegador.
  latestPix:latestPix?{id:String(latestPix._id),status:latestPix.status,amountCents:latestPix.amountCents,paidAt:latestPix.paidAt??null}:null
 });
}));
billingRouter.post('/pix',requireCompleteName,asyncRoute(async(req,res)=>{
 if(!pixPaymentConfig().enabled)throw new HttpError(503,'Pix de teste ainda não configurado');
 const userId=new mongoose.Types.ObjectId(uid(req));
 const user=await User.findById(userId).select('name firstName lastName email createdAt phone');if(!user)throw new HttpError(401,'Conta inválida');
 const buyer=nameParts(user.name);
 if(!buyer.complete)throw new HttpError(428,'Complete seu nome e sobrenome antes de gerar o Pix.');
 const [existingSub,existingCourtesy]=await Promise.all([
  BillingSubscription.findOne({userId}).select('activeUntil status').lean(),
  CourtesyGrant.findOne({userId,activeUntil:{$gt:new Date()}}).select('activeUntil').lean()
 ]);
 // Pix é permitido nos últimos 2 dias do plano, preservando os dias restantes.
 const renewal=subscriptionNotice({paidUntil:existingSub?.activeUntil,courtesyUntil:existingCourtesy?.activeUntil});
 if(!renewal.renewalAllowed)throw new HttpError(409,'Seu Premium ainda está ativo. A renovação fica disponível nas últimas 48 horas.');
 const recurring=await BillingSubscription.findOne({userId,method:'credit',providerSubscriptionId:{$exists:true},cancelAtPeriodEnd:false});
 if(recurring)throw new HttpError(409,'Cancele sua assinatura automática antes de utilizar Pix avulso');
 const expires=new Date(Date.now()+30*60*1000);
 const existing=await BillingPayment.findOne({userId,method:'pix',status:'pending',expiresAt:{$gt:new Date()}}).sort({createdAt:-1});
 if(existing?.pixCode)return res.json({paymentId:String(existing._id),pixCode:existing.pixCode,qrCodeBase64:existing.pixQrBase64,ticketUrl:existing.pixTicketUrl,expiresAt:existing.expiresAt});
 const priceCents=(await getAdminSettings()).weeklyPriceCents;
 // Reaproveita a mesma chave de idempotência se a chamada anterior tiver falhado/expirado no transporte.
 const pay=existing??await BillingPayment.create({userId,method:'pix',status:'pending',amountCents:priceCents,idempotencyKey:randomUUID(),expiresAt:expires});
 const order=pay.providerOrderId
  ? await mpPix<MpPixOrder>('GET',`/v1/orders/${encodeURIComponent(pay.providerOrderId)}`)
  : await mpPix<MpPixOrder>('POST','/v1/orders',{
   ...makePixOrderPayload(String(pay._id),pay.amountCents,user.email,user.name,user.firstName,user.lastName)
  },pay.idempotencyKey,typeof req.header('x-mp-device-id')==='string'?req.header('x-mp-device-id'):undefined);
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
// Cartão de crédito desativado nesta fase. A rota permanece para negar clientes antigos.
billingRouter.post('/credit',(_req,res)=>{
 res.status(410).json({error:'Assinaturas por cartão indisponíveis. Utilize o Pix semanal.'});
});
billingRouter.post('/refresh',asyncRoute(async(req,res)=>{
 const userId=new mongoose.Types.ObjectId(uid(req));
 // Também reconcilia aprovações gravadas antes de uma eventual falha ao liberar o Premium.
 const pay=await BillingPayment.findOne({userId,method:'pix',status:{$in:['pending','approved']}}).sort({createdAt:-1});
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
