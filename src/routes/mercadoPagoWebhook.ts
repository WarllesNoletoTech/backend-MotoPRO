import {Router} from 'express';
import {asyncRoute} from '../utils/http.js';
import {paymentConfig,pixPaymentConfig,verifyMercadoPagoSignature} from '../services/mercadoPago.js';
import {syncPixPayment,syncPixOrder,syncCreditPayment,syncCreditSubscription} from '../services/billing.js';
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

// MotoPRO PIX (API de Orders) usa seu próprio segredo de assinatura e Access Token.
mercadoPagoWebhookRouter.post('/orders',asyncRoute(async(req,res)=>{
 const cfg=pixPaymentConfig();
 if(!cfg.enabled)return res.status(503).json({error:'Pix ainda não habilitado'});
 const queryId=req.query['data.id'];
 // A assinatura é vinculada ao ID da query; não aceitamos um ID arbitrário no corpo.
 if(typeof queryId!=='string' || !/^ORD[0-9A-Za-z]+$/.test(queryId))return res.sendStatus(400);
 if(!verifyMercadoPagoSignature(req.header('x-signature'),req.header('x-request-id'),queryId,cfg.secret))return res.sendStatus(401);
 const topic=String(req.query.type||req.body?.type||'');
 if(topic!=='order' && topic!=='orders')return res.sendStatus(200);
 await syncPixOrder(queryId); // O status é verificado diretamente no Mercado Pago, nunca pelo JSON recebido.
 res.sendStatus(200);
}));
