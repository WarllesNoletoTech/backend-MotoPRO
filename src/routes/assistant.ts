import {Router} from 'express';
import {z} from 'zod';
import multer from 'multer';
import OpenAI,{toFile} from 'openai';
import {config} from '../config.js';
import {interpretWithAI} from '../services/aiCommands.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {uid} from '../services/auth.js';
import {User} from '../models/User.js';
import {dateInTimezone,weekRangeTuesday} from '../utils/dates.js';
import {financialSummary} from './dashboard.js';
export const assistantRouter=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024},fileFilter:(_req,file,cb)=>{
 if(!['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/ogg','audio/x-m4a'].includes(file.mimetype.split(';')[0]))return cb(new HttpError(400,'Formato de áudio não suportado'));
 cb(null,true);
}});
assistantRouter.post('/interpret',asyncRoute(async(req,res)=>{
 const {text}=z.object({text:z.string().trim().min(1).max(500)}).parse(req.body);
 const {command:result,engine,advisory}=await interpretWithAI(text,config.openaiApiKey,config.commandModel);
 if(result.kind==='summary'){
  const user=await User.findById(uid(req)).select('timezone');
  const today=dateInTimezone(user?.timezone||'America/Belem');
  const range=result.period==='today'?{from:today,to:today}:weekRangeTuesday(today);
  const summary=await financialSummary(uid(req),range.from,range.to);
  return res.json({...result,summary,range,engine,advisory});
 }
 res.json({...result,engine,advisory});
}));
assistantRouter.post('/transcribe',upload.single('audio'),asyncRoute(async(req,res)=>{
 if(!req.file)throw new HttpError(400,'Envie uma gravação de áudio válida');
 // O navegador encerra em 10 segundos e informa a duração; tolerância de 750ms para o MediaRecorder.
 // A duração informada pelo cliente não substitui validação técnica de mídia contra clientes adulterados.
 const durationMs=Number(req.body?.durationMs);
 if(!Number.isFinite(durationMs)||durationMs<200||durationMs>10_750)
  throw new HttpError(400,'O áudio deve ter no máximo 10 segundos. Grave um comando curto.');
 if(!config.openaiApiKey)throw new HttpError(503,'Transcrição por voz ainda não configurada no servidor. Use o comando digitado.');
 const client=new OpenAI({apiKey:config.openaiApiKey});
 const extension=req.file.mimetype.includes('webm')?'webm':req.file.mimetype.includes('ogg')?'ogg':req.file.mimetype.includes('wav')?'wav':'mp4';
 const file=await toFile(req.file.buffer,`comando.${extension}`,{type:req.file.mimetype});
 const transcription=await client.audio.transcriptions.create({
  file,model:config.transcriptionModel,language:'pt',
  prompt:'Áudio curto em português brasileiro de um motoboy. Vocabulário frequente: MotoPRO, Rappidex, Pix, ganhei, recebi, entregas, corridas, gorjeta, abasteci, abastecimento, gasolina, etanol, combustível, manutenção, revisão, óleo, quilômetros, reais e centavos; números grandes como mil, 1000, 1.000, vinte e cinco mil, mil e quinhentos. Os valores devem refletir somente o que a pessoa realmente disse.'
 });
 res.json({text:(transcription.text||'').trim().slice(0,500)});
}));
