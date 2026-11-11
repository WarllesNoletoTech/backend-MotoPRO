import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import {User} from '../models/User.js';
import {ReportEmailPreference} from '../models/ReportEmailPreference.js';
import {uid} from '../services/auth.js';
import {hashToken,newVerificationToken,reportEmailConfigured,sendReportEmail} from '../services/reportEmail.js';
import {asyncRoute,HttpError} from '../utils/http.js';

export const reportEmailPreferencesRouter=Router();
const emailLimiter=rateLimit({windowMs:60*60_000,limit:8,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Muitas tentativas. Tente novamente mais tarde.'}});

reportEmailPreferencesRouter.get('/',asyncRoute(async(req,res)=>{
 const [rawUser,pref]=await Promise.all([
  User.findById(uid(req)).select('email').lean(),
  ReportEmailPreference.findOne({userId:uid(req)}).select('email enabled verifiedAt verificationExpiresAt').lean()
 ]);
 const user=rawUser as unknown as {email:string}|null;
 const preference=pref as unknown as {enabled:boolean;verifiedAt:Date|null;email:string;verificationExpiresAt:Date|null}|null;
 if(!user)throw new HttpError(404,'Conta não encontrada');
 res.setHeader('Cache-Control','private, no-store');
 res.json({email:user.email,enabled:!!(preference?.enabled&&preference?.verifiedAt&&preference.email===user.email),
  pendingVerification:!!(!preference?.enabled&&preference?.verificationExpiresAt&&preference.verificationExpiresAt>new Date()),
  configured:reportEmailConfigured()});
}));

reportEmailPreferencesRouter.post('/request',emailLimiter,asyncRoute(async(req,res)=>{
 if(!reportEmailConfigured())throw new HttpError(503,'Envio automático ainda não está configurado pelo administrador.');
 const user=(await User.findById(uid(req)).select('name email role').lean()) as unknown as {name:string;email:string;role:string;_id:unknown}|null;
 if(!user||user.role!=='driver')throw new HttpError(403,'Recurso exclusivo para entregadores.');
 const prev=(await ReportEmailPreference.findOne({userId:uid(req)}).select('enabled verifiedAt email lastVerificationSentAt').lean()) as unknown as {
  enabled:boolean;verifiedAt:Date|null;email:string;lastVerificationSentAt:Date|null
 }|null;
 if(prev?.enabled&&prev.verifiedAt&&prev.email===user.email)return res.json({ok:true,enabled:true});
 if(prev?.lastVerificationSentAt&&Date.now()-new Date(prev.lastVerificationSentAt).getTime()<60_000)
  throw new HttpError(429,'Aguarde um minuto antes de pedir outro e-mail de confirmação.');
 const token=newVerificationToken();const now=new Date();
 await ReportEmailPreference.findOneAndUpdate({userId:uid(req)},{
  $set:{email:user.email,enabled:false,verifiedAt:null,verificationHash:hashToken(token),
   verificationExpiresAt:new Date(now.getTime()+24*3600_000),lastVerificationSentAt:now}
 },{upsert:true,new:true});
 const link=`${process.env.APP_ORIGIN||'http://localhost:3000'}/app/configuracoes?confirmarRelatorio=${token}`;
 await sendReportEmail(user.email,'Confirme o recebimento do resumo semanal MotoPRO',
  `Olá, ${user.name.split(' ')[0]}!\n\nVocê solicitou o envio automático do seu fechamento semanal por e-mail.\nConfirme seu endereço acessando o link abaixo (válido por 24 horas):\n${link}\n\nSe aparecer a tela de login, entre na sua conta e abra o link novamente.\nSe você não solicitou, ignore esta mensagem.`,
  `verify-${String(user._id)}-${hashToken(token).slice(0,12)}`);
 res.setHeader('Cache-Control','no-store');res.json({ok:true,enabled:false,confirmationSent:true});
}));

reportEmailPreferencesRouter.post('/confirm',emailLimiter,asyncRoute(async(req,res)=>{
 const {token}=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(req.body);
 const user=(await User.findById(uid(req)).select('email').lean()) as unknown as {email:string}|null;
 if(!user)throw new HttpError(404,'Conta não encontrada');
 const result=await ReportEmailPreference.findOneAndUpdate({userId:uid(req),email:user.email,
  verificationHash:hashToken(token),verificationExpiresAt:{$gt:new Date()}},
  {$set:{enabled:true,verifiedAt:new Date()},$unset:{verificationHash:'',verificationExpiresAt:''}},
  {new:true});
 if(!result)throw new HttpError(400,'Link expirado ou inválido. Solicite outra confirmação.');
 res.setHeader('Cache-Control','no-store');res.json({ok:true,enabled:true});
}));

// Disponível fora do Premium: cancelamento do consentimento não depende da assinatura.
reportEmailPreferencesRouter.delete('/',asyncRoute(async(req,res)=>{
 await ReportEmailPreference.updateOne({userId:uid(req)},{$set:{enabled:false,verifiedAt:null},
  $unset:{verificationHash:'',verificationExpiresAt:''}});
 res.setHeader('Cache-Control','no-store');res.json({ok:true,enabled:false});
}));
