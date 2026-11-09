import {Router} from 'express';
import {asyncRoute} from '../utils/http.js';
import {paymentConfig,verifyMercadoPagoSignature} from '../services/mercadoPago.js';
import {syncPixPayment,syncCreditPayment,syncCreditSubscription} from '../services/billing.js';
export const mercadoPagoWebhookRouter=Router();
mercadoPagoWebhookRouter.post('/',asyncRoute(async(req,res)=>{
 const cfg=paymentConfig();
 if(!cfg.enabled)return res.status(503).json({error:'Notificação não configurada'});
 const dataId=String(req.query['data.id']||req.body?.data?.id||'');
 const signature=req.header('x-signature');
 const requestId=req.header('x-request-id');
 if(!verifyMercadoPagoSignature(signature,requestId,dataId,cfg.secret))return res.sendStatus(401);
 const topic=String(req.query.type||req.body?.type||req.query.topic||'');
 if(topic==='payment')await syncPixPayment(dataId);
 if(topic==='subscription_preapproval')await syncCreditSubscription(dataId);
 if(topic==='subscription_authorized_payment')await syncCreditPayment(dataId);
 // Assinaturas e pagamentos fora da nossa base são ignorados.
 res.sendStatus(200);
}));
