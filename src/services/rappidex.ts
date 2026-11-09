import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {Entry} from '../models/Entry.js';
import {IntegrationConnection} from '../models/IntegrationConnection.js';
import {addDays,dateInTimezone,isValidDateOnly} from '../utils/dates.js';
import {HttpError} from '../utils/http.js';
const base=()=>String(process.env.RAPPIDEX_API_URL||'').trim().replace(/\/+$/,'');
const key=()=>String(process.env.RAPPIDEX_INTEGRATION_SECRET||'');
export function rappidexReady(){const url=base();return key().length>=32&&
 (process.env.NODE_ENV==='production'?url.startsWith('https://'):/^https?:\/\//.test(url))&&!/[?#]/.test(url);}
async function remote<T>(path:string,method='GET',body?:object):Promise<T>{
 if(!rappidexReady())throw new HttpError(503,'Integração Rappidex não configurada pelo administrador.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch(`${base()}/api/motopro${path}`,{method,headers:{Authorization:`Bearer ${key()}`,'Content-Type':'application/json'},
   ...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,redirect:'error'});
  if(!r.ok){
   if(r.status===401)throw new HttpError(502,'Chave MotoPRO/Rappidex incorreta.');
   if(r.status===403||r.status===404||r.status===409)throw new HttpError(r.status===404?404:409,'Conta Rappidex não autorizada, vínculo revogado ou código expirado.');
   throw new HttpError(502,'Rappidex retornou erro.');
  }
  return await r.json() as T;
 }catch(err){if(err instanceof HttpError)throw err;throw new HttpError(502,'Rappidex indisponível. Tente novamente.');}
 finally{clearTimeout(timer);}
}
const connectionResponse=z.object({motoboyId:z.string().min(1).max(100),motoboyName:z.string().min(1).max(110)});
/** Dados de um único vínculo. O model legado usa `models.X || model(...)`,
 * que faz o Mongoose inferir `lean()` como objeto OU array no TS.
 * Como `findOne` sempre retorna um único documento ou null, estreitamos o tipo aqui.
 */
type RappidexConnectionLean = {
  _id: mongoose.Types.ObjectId;
  remoteName: string;
  remoteUserId: string;
  createdAt: Date;
  lastSyncAt: Date | null;
};
const pageResponse=z.object({
 items:z.array(z.object({id:z.string().min(1).max(100),amountCents:z.number().int().positive().max(100_000_000),occurredOn:z.string().refine(isValidDateOnly)})).max(100),
 missingPayoutCount:z.number().int().min(0).max(100),hasMore:z.boolean(),page:z.number().int().positive(),
});
export async function getConnection(userId:string){
 const c=(await IntegrationConnection.findOne({userId,provider:'rappidex'}).lean()) as RappidexConnectionLean | null;
 return c?{name:c.remoteName,linkedAt:c.createdAt,lastSyncAt:c.lastSyncAt}:null;
}
export async function linkRappidex(userId:string,code:string){
 if(await IntegrationConnection.exists({userId,provider:'rappidex'}))throw new HttpError(409,'Desconecte a conta atual antes de conectar outra.');
 const info=connectionResponse.parse(await remote<unknown>('/connect','POST',{code,motoproUserId:userId}));
 try{await IntegrationConnection.create({userId,provider:'rappidex',remoteUserId:info.motoboyId,remoteName:info.motoboyName});}
 catch{await remote('/disconnect','POST',{motoproUserId:userId,motoboyId:info.motoboyId}).catch(()=>{});throw new HttpError(409,'Conta já vinculada ou erro ao salvar vínculo.');}
 return {ok:true,name:info.motoboyName};
}
export async function unlinkRappidex(userId:string){
 const now=new Date(),lockToken=randomUUID();
 const c=await IntegrationConnection.findOneAndUpdate({userId,provider:'rappidex',
  $or:[{syncLockUntil:null},{syncLockUntil:{$exists:false}},{syncLockUntil:{$lt:now}}],
 },{$set:{syncLockUntil:new Date(now.getTime()+120000),syncLockToken:lockToken}},{new:true});
 if(!c){if(!await IntegrationConnection.exists({userId,provider:'rappidex'}))return {ok:true};throw new HttpError(409,'Sincronização em andamento. Tente desconectar novamente.');}
 try{
  try{await remote('/disconnect','POST',{motoproUserId:userId,motoboyId:c.remoteUserId});}
  catch(err){if(!(err instanceof HttpError)||err.statusCode!==404)throw err;}
  await IntegrationConnection.deleteOne({_id:c._id,syncLockToken:lockToken});
  return {ok:true};
 }finally{await IntegrationConnection.updateOne({_id:c._id,syncLockToken:lockToken},{$set:{syncLockUntil:null,syncLockToken:null}});}
}
export async function syncRappidex(userId:string,params:{from?:string;to?:string;force?:boolean}={}){
 const c=(await IntegrationConnection.findOne({userId,provider:'rappidex'}).lean()) as RappidexConnectionLean | null;
 if(!c)return {linked:false,created:0,updated:0,removed:0,missingPayoutCount:0};
 const to=params.to||dateInTimezone('America/Belem'),from=params.from||addDays(to,-29);
 const diff=Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`);
 if(!isValidDateOnly(from)||!isValidDateOnly(to)||from>to||diff>30*86400000||Date.parse(`${to}T12:00:00Z`)>Date.now()+86400000)throw new HttpError(400,'Selecione um intervalo válido de até 31 dias.');
 const automatic=!params.force&&!params.from&&!params.to;
 if(automatic&&c.lastSyncAt&&new Date(c.lastSyncAt).getTime()>Date.now()-600000)return {linked:true,skipped:'recent',created:0,updated:0,removed:0,missingPayoutCount:0};
 const now=new Date(),lockToken=randomUUID();
 const lock=await IntegrationConnection.findOneAndUpdate({_id:c._id,
  $or:[{syncLockUntil:null},{syncLockUntil:{$exists:false}},{syncLockUntil:{$lt:now}}],
 },{$set:{syncLockUntil:new Date(now.getTime()+120000),syncLockToken:lockToken}},{new:true});
 if(!lock)return {linked:true,skipped:'running',created:0,updated:0,removed:0,missingPayoutCount:0};
 try{
  const all:{id:string;amountCents:number;occurredOn:string}[]=[];
  let missingPayoutCount=0,finished=false;
  for(let page=1;page<=100;page++){
   const query=new URLSearchParams({motoproUserId:userId,from,to,page:String(page)});
   const data=pageResponse.parse(await remote<unknown>(`/earnings?${query.toString()}`));
   if(data.page!==page||data.items.some(x=>x.occurredOn<from||x.occurredOn>to))throw new HttpError(502,'Resposta do Rappidex inconsistente.');
   all.push(...data.items);missingPayoutCount+=data.missingPayoutCount;
   if(!data.hasMore){finished=true;break;}
  }
  if(!finished)throw new HttpError(502,'Limite de paginação. Nenhum lançamento revertido.');
  const unique=[...new Map(all.map(x=>[x.id,x])).values()];
  const ids=unique.map(x=>x.id),userObjectId=new mongoose.Types.ObjectId(userId);
  const existing=await Entry.find({userId:userObjectId,provider:'rappidex',source:'integration',occurredOn:{$gte:from,$lte:to}}).select('externalId').lean();
  const known=new Set(existing.map(x=>x.externalId));
  if(unique.length)await Entry.bulkWrite(unique.map(item=>({updateOne:{
   filter:{userId:userObjectId,provider:'rappidex',source:'integration',externalId:item.id},
   update:{$set:{type:'income',category:'delivery',description:'Repasse previsto · Rappidex',amountCents:item.amountCents,occurredOn:item.occurredOn},
    $setOnInsert:{userId:userObjectId,provider:'rappidex',source:'integration',externalId:item.id}},
   upsert:true,
  }})),{ordered:false});
  // Reconciliar somente após obter todas as páginas sem erro. Inclui reversão de cancelamentos na origem.
  const removed=await Entry.deleteMany({userId:userObjectId,source:'integration',provider:'rappidex',occurredOn:{$gte:from,$lte:to},externalId:{$nin:ids}});
  await IntegrationConnection.updateOne({_id:c._id,syncLockToken:lockToken},{$set:{lastSyncAt:new Date()}});
  return {linked:true,created:unique.filter(x=>!known.has(x.id)).length,updated:unique.filter(x=>known.has(x.id)).length,
   removed:removed.deletedCount||0,missingPayoutCount};
 }finally{await IntegrationConnection.updateOne({_id:c._id,syncLockToken:lockToken},{$set:{syncLockUntil:null,syncLockToken:null}});}
}
