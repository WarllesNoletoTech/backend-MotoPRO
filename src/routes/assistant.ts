import {Router} from 'express';
import {z} from 'zod';
import multer from 'multer';
import {recognizeAudio,speechModel} from '../services/speechToText.js';
import {config} from '../config.js';
import {interpretWithAI} from '../services/aiCommands.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {uid} from '../services/auth.js';
import {User} from '../models/User.js';
import {Goal} from '../models/Goal.js';
import {dateInTimezone,weekRangeTuesday} from '../utils/dates.js';
import {financialSummary} from './dashboard.js';
import {logAiUsage} from '../services/aiUsage.js';
import {rateLimit} from 'express-rate-limit';
export const assistantRouter=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024},fileFilter:(_req,file,cb)=>{
 if(!['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/ogg','audio/x-m4a'].includes(file.mimetype.split(';')[0]))return cb(new HttpError(400,'Formato de áudio não suportado'));
 cb(null,true);
}});
assistantRouter.post('/interpret',rateLimit({windowMs:3600_000,limit:120,keyGenerator:req=>uid(req),standardHeaders:'draft-7',legacyHeaders:false}),asyncRoute(async(req,res)=>{
 const {text}=z.object({text:z.string().trim().min(1).max(500)}).parse(req.body);
 const {command:result,engine,advisory,usage}=await interpretWithAI(text,config.openaiApiKey,config.commandModel);
 await logAiUsage(uid(req),'interpretation',engine==='ai'?'success':'fallback',engine==='ai'?config.commandModel:'basic',usage);
 if(result.kind==='summary'){
  const user=await User.findById(uid(req)).select('timezone');
  const today=dateInTimezone(user?.timezone||'America/Belem');
  const range=result.period==='today'?{from:today,to:today}:result.period==='month'?{from:today.slice(0,7)+'-01',to:today}:weekRangeTuesday(today);
  const summary=await financialSummary(uid(req),range.from,range.to);
  const goal=await Goal.findOne({userId:uid(req)}).lean();
  const targetCents=result.period==='month'?(goal?.monthlyTargetCents||0):result.period==='week'?(goal?.weeklyTargetCents||0):0;
  const endDate=result.period==='month'
   ?new Date(Number(today.slice(0,4)),Number(today.slice(5,7)),0).getDate()
   :Number(range.to.slice(8,10));
  const daysRemaining=result.period==='month'
   ?Math.max(1,endDate-Number(today.slice(8,10))+1)
   :result.period==='week'?Math.max(1,Math.round((new Date(range.to+'T00:00:00Z').getTime()-new Date(today+'T00:00:00Z').getTime())/86400_000)+1):1;
  const remainingCents=targetCents?Math.max(0,targetCents-summary.profitCents):0;
  return res.json({...result,summary,range,engine,advisory,goal:targetCents?{
   targetCents,remainingCents,daysRemaining,requiredDailyCents:Math.ceil(remainingCents/daysRemaining)
  }:null});
 }
 res.json({...result,engine,advisory});
}));
assistantRouter.post('/transcribe',rateLimit({windowMs:3600_000,limit:60,keyGenerator:req=>uid(req),standardHeaders:'draft-7',legacyHeaders:false}),upload.single('audio'),asyncRoute(async(req,res)=>{
 if(!req.file)throw new HttpError(400,'Envie uma gravação de áudio válida');
 // O navegador encerra em 10 segundos e informa a duração; tolerância de 750ms para o MediaRecorder.
 // A duração informada pelo cliente não substitui validação técnica de mídia contra clientes adulterados.
 const durationMs=Number(req.body?.durationMs);
 if(!Number.isFinite(durationMs)||durationMs<200||durationMs>10_750)
  throw new HttpError(400,'O áudio deve ter no máximo 10 segundos. Grave um comando curto.');
 if(!config.openaiApiKey)throw new HttpError(503,'Transcrição por voz ainda não configurada no servidor. Use o comando digitado.');
 const model=speechModel(config.transcriptionModel,req.body?.mode==='alternative');
 try{
  const recognized=await recognizeAudio(req.file.buffer,req.file.mimetype,config.openaiApiKey,model);
  await logAiUsage(uid(req),'transcription','success',model);
  if(req.body?.doubleCheck==='true'){
   const otherModel=speechModel(config.transcriptionModel,true);
   try{
    const alternative=await recognizeAudio(req.file.buffer,req.file.mimetype,config.openaiApiKey,otherModel);
    await logAiUsage(uid(req),'transcription','success',otherModel);
    const differs=recognized.toLocaleLowerCase('pt-BR')!==alternative.toLocaleLowerCase('pt-BR');
    return res.json({text:recognized,alternative,engine:model,secondEngine:otherModel,
     requiresReview:differs,
     warning:differs?'Duas transcrições diferentes. Confira o áudio antes de interpretar.':null});
   }catch(err){
    await logAiUsage(uid(req),'transcription','failed',otherModel);
    return res.json({text:recognized,engine:model,warning:'Segunda transcrição indisponível. Confira o áudio antes de salvar.'});
   }
  }
  res.json({text:recognized,engine:model});
 }catch(e){await logAiUsage(uid(req),'transcription','failed',model);throw e;}
}));
