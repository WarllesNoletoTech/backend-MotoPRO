import {Router} from 'express';
import multer from 'multer';
import {rateLimit} from 'express-rate-limit';
import {createHash} from 'node:crypto';
import {ReceiptAnalysis} from '../models/ReceiptAnalysis.js';
import {Entry} from '../models/Entry.js';
import {uid} from '../services/auth.js';
import {config} from '../config.js';
import {asyncRoute,HttpError,validId} from '../utils/http.js';
import {dateInTimezone} from '../utils/dates.js';
import {analyzeReceipt,receiptConfirmationSchema,verifyReceiptImage} from '../services/receiptAI.js';
import {logAiUsage} from '../services/aiUsage.js';

export const receiptsRouter=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:4*1024*1024,files:1},fileFilter:(_req,f,cb)=>{
 if(!['image/jpeg','image/png','image/webp'].includes(f.mimetype))return cb(new HttpError(400,'Imagem deve ser JPG, PNG ou WEBP'));
 cb(null,true);
}});
// O limite global de /api não substitui cotas de processamento de IA.
receiptsRouter.post('/analyze',rateLimit({windowMs:3600_000,limit:12,keyGenerator:req=>uid(req),standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Limite de 12 leituras por hora atingido.'}}),upload.single('image'),asyncRoute(async(req,res)=>{
 if(!req.file)throw new HttpError(400,'Envie uma foto de comprovante');
 const userId=uid(req),mime=req.file.mimetype;
 verifyReceiptImage(req.file.buffer,mime);
 const fingerprint=createHash('sha256').update(req.file.buffer).digest('hex');
 const existing=await ReceiptAnalysis.findOne({userId,fingerprint});
 if(existing){
  const saved=await Entry.exists({userId,receiptId:existing._id});
  return res.json({scanId:String(existing._id),suggestion:existing.suggestion,alreadyConfirmed:!!saved,repeat:true});
 }
 const model=process.env.OPENAI_RECEIPT_MODEL||config.commandModel;
 try{
  const {suggestion,usage}=await analyzeReceipt(req.file.buffer,mime,config.openaiApiKey,model,dateInTimezone('America/Belem'));
  // A imagem não é persistida nem exibida ao administrador.
  const record=await ReceiptAnalysis.findOneAndUpdate({userId,fingerprint},{$setOnInsert:{suggestion,expiresAt:new Date(Date.now()+30*86400000)}},{upsert:true,new:true,setDefaultsOnInsert:true});
  await logAiUsage(userId,'receipt','success',model,{inputTokens:usage?.input_tokens||0,outputTokens:usage?.output_tokens||0});
  res.json({scanId:String(record._id),suggestion:record.suggestion,alreadyConfirmed:!!record.confirmedEntryId,repeat:false});
 }catch(err){await logAiUsage(userId,'receipt','failed',model);throw err;}
}));
receiptsRouter.post('/:id/confirm',asyncRoute(async(req,res)=>{
 if(!validId(req.params.id))throw new HttpError(400,'Identificação do comprovante inválida');
 const userId=uid(req),data=receiptConfirmationSchema.parse(req.body);
 const current=await ReceiptAnalysis.findOne({_id:req.params.id,userId});
 if(!current)throw new HttpError(404,'Comprovante expirado ou não encontrado. Faça nova leitura.');
 const today=dateInTimezone('America/Belem');
 if(data.occurredOn>today)throw new HttpError(400,'Data do comprovante não pode ser futura');
 // Única entrada por (usuário, comprovante); várias confirmações/retries não geram gastos repetidos.
 const wasSaved=!!await Entry.exists({userId,receiptId:current._id});
 const entry=await Entry.findOneAndUpdate({userId,receiptId:current._id},{
   $setOnInsert:{userId,receiptId:current._id,source:'receipt',...data}
 },{upsert:true,new:true,setDefaultsOnInsert:true});
 await ReceiptAnalysis.updateOne({_id:current._id,userId},{$set:{confirmedEntryId:entry._id}});
 res.json({entry,alreadySaved:wasSaved});
}));
