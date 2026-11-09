import {Router} from 'express';
import {z} from 'zod';
import multer from 'multer';
import OpenAI,{toFile} from 'openai';
import {config} from '../config.js';
import {parseCommand} from '../services/commands.js';
import {asyncRoute,HttpError} from '../utils/http.js';
import {uid} from '../services/auth.js';
import {User} from '../models/User.js';
import {dateInTimezone,weekRangeTuesday} from '../utils/dates.js';
import {financialSummary} from './dashboard.js';
export const assistantRouter=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024},fileFilter:(_req,file,cb)=>{
 if(!['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/ogg','audio/x-m4a'].includes(file.mimetype.split(';')[0]))return cb(new HttpError(400,'Formato de áudio não suportado'));
 cb(null,true);
}});
assistantRouter.post('/interpret',asyncRoute(async(req,res)=>{
 const {text}=z.object({text:z.string().trim().min(1).max(500)}).parse(req.body);
 const result=parseCommand(text);
 if(result.kind==='summary'){
  const user=await User.findById(uid(req)).select('timezone');
  const today=dateInTimezone(user?.timezone||'America/Belem');
  const range=result.period==='today'?{from:today,to:today}:weekRangeTuesday(today);
  const summary=await financialSummary(uid(req),range.from,range.to);
  return res.json({...result,summary,range});
 }
 res.json(result);
}));
assistantRouter.post('/transcribe',upload.single('audio'),asyncRoute(async(req,res)=>{
 if(!req.file)throw new HttpError(400,'Envie uma gravação de áudio válida');
 if(!config.openaiApiKey)throw new HttpError(503,'Transcrição por voz ainda não configurada no servidor. Use o comando digitado.');
 const client=new OpenAI({apiKey:config.openaiApiKey});
 const extension=req.file.mimetype.includes('webm')?'webm':req.file.mimetype.includes('ogg')?'ogg':req.file.mimetype.includes('wav')?'wav':'mp4';
 const file=await toFile(req.file.buffer,`comando.${extension}`,{type:req.file.mimetype});
 const transcription=await client.audio.transcriptions.create({file,model:config.transcriptionModel,language:'pt'});
 res.json({text:transcription.text});
}));
