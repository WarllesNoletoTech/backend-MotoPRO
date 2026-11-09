import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoose from 'mongoose';
import {rateLimit} from 'express-rate-limit';
import {config,validateConfig} from './config.js';
import {errorHandler} from './utils/http.js';
import {authRouter} from './routes/auth.js';
import {billingRouter} from './routes/billing.js';
import {mercadoPagoWebhookRouter} from './routes/mercadoPagoWebhook.js';
import {adminBillingRouter} from './routes/adminBilling.js';
import {RewardCampaign} from './models/RewardCampaign.js';
import {getAdminSettings} from './models/AdminSetting.js';
import {entriesRouter} from './routes/entries.js';
import {dashboardRouter} from './routes/dashboard.js';
import {motoRouter} from './routes/moto.js';
import {goalsRouter} from './routes/goals.js';
import {assistantRouter} from './routes/assistant.js';
import {requireAuth} from './services/auth.js';
import {requirePremium} from './services/premium.js';
import {accountRouter} from './routes/account.js';
import {integrationsRouter} from './routes/integrations.js';

async function bootstrap(){
 validateConfig();
 await mongoose.connect(config.mongoUri,{serverSelectionTimeoutMS:10000});
 const app=express();
 app.disable('x-powered-by');
 app.set('trust proxy',1);
 app.use(helmet());
 app.use(express.json({limit:'32kb'}));
 app.use(cookieParser());
 app.use('/api',rateLimit({windowMs:60_000,limit:240,standardHeaders:'draft-7',legacyHeaders:false}));
 // Proteção CSRF para requisições autenticadas do navegador.
 app.use('/api',(req,res,next)=>{
  if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
  const origin=req.headers.origin;
  if(origin && origin!==config.appOrigin)return res.status(403).json({error:'Origem não autorizada'});
  next();
 });
 app.get('/api/health',(_req,res)=>res.json({status:'ok',service:'motopro-api'}));
 app.get('/api/public/settings',async(_req,res,next)=>{try{const s=await getAdminSettings();res.json({announcement:s.announcement,maintenanceNotice:s.maintenanceNotice,premiumBenefits:s.premiumBenefits,trialDays:s.trialDays,weeklyPriceCents:s.weeklyPriceCents});}catch(err){next(err);}});
 app.use('/api/auth',authRouter);
 app.use('/api/webhooks/mercadopago',mercadoPagoWebhookRouter);
 app.use('/api/billing',requireAuth,billingRouter);
 app.use('/api/admin/billing',requireAuth,adminBillingRouter);
 app.use('/api/account',requireAuth,accountRouter); // Dados próprios disponíveis mesmo após vencimento.
 app.get('/api/campaigns',requireAuth,requirePremium,async(_req,res,next)=>{try{const docs=await RewardCampaign.find({status:{$in:['published','closed']}}).sort({createdAt:-1}).limit(30).select('title description reward objectiveCriteria startsAt endsAt status resultSummary').lean();res.json({items:docs});}catch(err){next(err);}});
 app.use('/api/dashboard',requireAuth,requirePremium,dashboardRouter);
 app.use('/api/entries',requireAuth,requirePremium,entriesRouter);
 app.use('/api/moto',requireAuth,requirePremium,motoRouter);
 app.use('/api/goals',requireAuth,requirePremium,goalsRouter);
 app.use('/api/assistant',requireAuth,requirePremium,assistantRouter);
 app.use('/api/integrations',requireAuth,integrationsRouter);
 app.use((_req,res)=>res.status(404).json({error:'Rota não encontrada'}));
 app.use(errorHandler);
 app.listen(config.port,()=>console.log(`MotoPRO API: http://localhost:${config.port}`));
}
bootstrap().catch(err=>{console.error('Falha ao iniciar API:',err);process.exit(1);});
