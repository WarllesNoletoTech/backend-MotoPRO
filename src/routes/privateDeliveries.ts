import {Router} from 'express';
import mongoose from 'mongoose';
import {z} from 'zod';
import {PrivateCustomer} from '../models/PrivateCustomer.js';
import {PrivateDelivery} from '../models/PrivateDelivery.js';
import {Entry} from '../models/Entry.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError,validId} from '../utils/http.js';
import {dateInTimezone,isValidDateOnly} from '../utils/dates.js';

export const privateRouter=Router();
const customerSchema=z.object({
 name:z.string().trim().min(2).max(90),
 phone:z.string().trim().max(16).refine(s=>!s||(/^[+0-9 ()-]{10,16}$/.test(s)&&s.replace(/\D/g,'').length>=10&&s.replace(/\D/g,'').length<=13),'Telefone inválido').optional().default(''),
 notes:z.string().trim().max(300).optional().default('')
}).strict();
const deliverySchema=z.object({
 customerId:z.string().refine(validId,'Cliente inválido').nullable().default(null),
 description:z.string().trim().max(160).default(''),
 amountCents:z.number().int().min(1).max(100_000_000),
 deliveredOn:z.string().refine(isValidDateOnly,'Data inválida')
}).strict();
const pageSchema=z.object({page:z.coerce.number().int().min(1).max(1000).default(1),limit:z.coerce.number().int().min(1).max(50).default(15)});
const requiredId=(id:string)=>{if(!validId(id))throw new HttpError(400,'ID inválido');return new mongoose.Types.ObjectId(id);};

privateRouter.get('/customers',asyncRoute(async(req,res)=>{
 const {page,limit}=pageSchema.parse(req.query);
 const search=z.string().trim().max(60).optional().parse(req.query.search);
 const filter:Record<string,unknown>={userId:requiredId(uid(req)),erasedAt:{$exists:false}};
 if(search){const escaped=search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.name={$regex:escaped,$options:'i'};}
 const [items,total]=await Promise.all([
  PrivateCustomer.find(filter).sort({archived:1,name:1}).skip((page-1)*limit).limit(limit).lean(),
  PrivateCustomer.countDocuments(filter)
 ]);
 res.setHeader('Cache-Control','private, no-store');
 res.json({items:items.map(x=>({id:String(x._id),name:x.name,phone:x.phone||'',notes:x.notes||'',archived:x.archived})),page,limit,total});
}));
privateRouter.post('/customers',asyncRoute(async(req,res)=>{
 const data=customerSchema.parse(req.body);
 const item=await PrivateCustomer.create({...data,userId:requiredId(uid(req)),archived:false});
 res.status(201).json({id:String(item._id)});
}));
privateRouter.patch('/customers/:id',asyncRoute(async(req,res)=>{
 const id=requiredId(req.params.id),patch=customerSchema.partial().extend({archived:z.boolean().optional()}).strict().parse(req.body);
 const item=await PrivateCustomer.findOneAndUpdate({_id:id,userId:requiredId(uid(req)),erasedAt:{$exists:false}},{$set:patch},{new:true,runValidators:true});
 if(!item)throw new HttpError(404,'Cliente não encontrado');
 res.json({ok:true});
}));
privateRouter.delete('/customers/:id',asyncRoute(async(req,res)=>{
 const id=requiredId(req.params.id),userId=requiredId(uid(req));
 const hasHistory=!!await PrivateDelivery.exists({customerId:id,userId});
 if(hasHistory){
  // Permite apagar dados de contato sem destruir o histórico financeiro do usuário.
  const erased=await PrivateCustomer.findOneAndUpdate({_id:id,userId,erasedAt:{$exists:false}},
   {$set:{name:'Cliente removido',phone:'',notes:'',archived:true,erasedAt:new Date()}},{new:true});
  if(!erased)throw new HttpError(404,'Cliente não encontrado');
  res.json({ok:true,anonymized:true});return;
 }
 const removed=await PrivateCustomer.findOneAndDelete({_id:id,userId,erasedAt:{$exists:false}});
 if(!removed)throw new HttpError(404,'Cliente não encontrado');
 res.json({ok:true,anonymized:false});
}));

type PlainDelivery={_id:mongoose.Types.ObjectId;customerId:mongoose.Types.ObjectId|null;description:string;amountCents:number;deliveredOn:string};
async function serializeDeliveries(userId:mongoose.Types.ObjectId,deliveries:PlainDelivery[]){
 // Cada entrega possui no máximo um lançamento financeiro (índice exclusivo em Entry).
 const ids=deliveries.map(d=>String(d._id));
 const customerIds=deliveries.flatMap(d=>d.customerId?[d.customerId]:[]);
 const [customers,payments]=await Promise.all([
  PrivateCustomer.find({_id:{$in:customerIds},userId}).select('name').lean(),
  Entry.find({userId,source:'private',provider:'private',externalId:{$in:ids}}).select('externalId createdAt').lean()
 ]);
 const byCustomer=new Map(customers.map(c=>[String(c._id),c.name]));
 const byPaid=new Map(payments.map(p=>[p.externalId,String((p as unknown as {createdAt:Date}).createdAt)]));
 return deliveries.map(d=>({id:String(d._id),customerId:d.customerId?String(d.customerId):null,
  customerName:d.customerId?(byCustomer.get(String(d.customerId))||'Cliente arquivado'):'Sem cliente informado',
  description:d.description,amountCents:d.amountCents,deliveredOn:d.deliveredOn,
  paymentStatus:byPaid.has(String(d._id))?'paid':'pending',paidAt:byPaid.get(String(d._id))||null}));
}
privateRouter.get('/deliveries',asyncRoute(async(req,res)=>{
 const {page,limit}=pageSchema.parse(req.query);
 const state=z.enum(['all','pending','paid']).parse(req.query.status||'all');
 const userId=requiredId(uid(req));
 // Evita resultados incompletos: filtra pago/pendente no banco por IDs de receitas pagas.
 const paidIds=await Entry.distinct('externalId',{userId,source:'private',provider:'private'});
 const validPaidIds=paidIds.filter(validId).map(id=>new mongoose.Types.ObjectId(id));
 const filter:Record<string,unknown>={userId};
 if(state==='paid')filter._id={$in:validPaidIds};
 if(state==='pending')filter._id={$nin:validPaidIds};
 const [deliveries,total,allStats,paidStats]=await Promise.all([
  PrivateDelivery.find(filter).sort({deliveredOn:-1,createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),
  PrivateDelivery.countDocuments(filter),
  PrivateDelivery.aggregate<{_id:null;amountCents:number;count:number}>([{$match:{userId}},{$group:{_id:null,amountCents:{$sum:'$amountCents'},count:{$sum:1}}}]),
  Entry.aggregate<{_id:null;amountCents:number;count:number}>([{$match:{userId,source:'private',provider:'private'}},{$group:{_id:null,amountCents:{$sum:'$amountCents'},count:{$sum:1}}}])
 ]);
 const items=await serializeDeliveries(userId,deliveries as unknown as PlainDelivery[]);
 res.setHeader('Cache-Control','private, no-store');
 res.json({page,limit,total,items,summary:{total:allStats[0]?.count||0,paid:paidStats[0]?.count||0,
  pending:Math.max(0,(allStats[0]?.count||0)-(paidStats[0]?.count||0)),
  paidCents:paidStats[0]?.amountCents||0,pendingCents:Math.max(0,(allStats[0]?.amountCents||0)-(paidStats[0]?.amountCents||0))}});
}));

privateRouter.get('/deliveries/export',asyncRoute(async(req,res)=>{
 const userId=requiredId(uid(req));
 const deliveries=await PrivateDelivery.find({userId}).sort({deliveredOn:-1,createdAt:-1}).limit(10_000).lean();
 const items=await serializeDeliveries(userId,deliveries as unknown as PlainDelivery[]);
 const csv=(value:unknown)=>{const text=String(value??'');const clean=/^[=+@-]/.test(text)?`'${text}`:text;return `"${clean.replace(/"/g,'""')}"`;};
 const rows=[['Data','Cliente','Descrição','Valor (R$)','Status','Data de confirmação'].map(csv).join(';'),
  ...items.map(d=>[d.deliveredOn,d.customerName,d.description,(d.amountCents/100).toFixed(2).replace('.',','),d.paymentStatus==='paid'?'Recebido':'Pendente',d.paidAt||''].map(csv).join(';'))];
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Content-Type','text/csv; charset=utf-8');
 res.setHeader('Content-Disposition','attachment; filename="motopro-entregas-particulares.csv"');
 res.send('\ufeff'+rows.join('\r\n'));
}));

privateRouter.post('/deliveries',asyncRoute(async(req,res)=>{
 const data=deliverySchema.parse(req.body),userId=requiredId(uid(req));
 if(data.customerId && !await PrivateCustomer.exists({_id:data.customerId,userId,archived:false}))throw new HttpError(404,'Cliente não encontrado ou arquivado');
 if(data.deliveredOn>dateInTimezone('America/Belem'))throw new HttpError(400,'A data da entrega não pode estar no futuro');
 const record=await PrivateDelivery.create({userId,...data});
 res.status(201).json({id:String(record._id),paymentStatus:'pending'});
}));
privateRouter.patch('/deliveries/:id',asyncRoute(async(req,res)=>{
 const id=requiredId(req.params.id),userId=requiredId(uid(req));
 const patch=deliverySchema.partial().strict().parse(req.body);
 if(await Entry.exists({userId,source:'private',provider:'private',externalId:String(id)}))throw new HttpError(409,'Entrega paga não pode ser alterada para preservar os registros financeiros');
 if(patch.deliveredOn&&patch.deliveredOn>dateInTimezone('America/Belem'))throw new HttpError(400,'A data da entrega não pode estar no futuro');
 if(patch.customerId){
  const linked=await PrivateCustomer.findOne({_id:patch.customerId,userId}).select('archived erasedAt').lean();
  if(!linked || (linked.archived && String((await PrivateDelivery.findOne({_id:id,userId}).select('customerId').lean())?.customerId||'')!==patch.customerId))
   throw new HttpError(404,'Cliente não encontrado ou arquivado');
 }
 const item=await PrivateDelivery.findOneAndUpdate({_id:id,userId,paymentLocked:{$ne:true}},{$set:patch},{new:true,runValidators:true});
 if(!item){if(await PrivateDelivery.exists({_id:id,userId}))throw new HttpError(409,'Recebimento iniciado. Confirme novamente antes de alterar a entrega.');throw new HttpError(404,'Entrega não encontrada');}
 res.json({ok:true});
}));
privateRouter.delete('/deliveries/:id',asyncRoute(async(req,res)=>{
 const id=requiredId(req.params.id),userId=requiredId(uid(req));
 if(await Entry.exists({userId,source:'private',provider:'private',externalId:String(id)}))throw new HttpError(409,'Entrega recebida não pode ser excluída; seus ganhos já foram contabilizados');
 const deleted=await PrivateDelivery.findOneAndDelete({_id:id,userId,paymentLocked:{$ne:true}});
 if(!deleted){if(await PrivateDelivery.exists({_id:id,userId}))throw new HttpError(409,'Recebimento iniciado. Confirme novamente antes de excluir.');throw new HttpError(404,'Entrega não encontrada');}
 res.json({ok:true});
}));
privateRouter.post('/deliveries/:id/confirm-payment',asyncRoute(async(req,res)=>{
 const id=requiredId(req.params.id),userId=requiredId(uid(req));
 const delivery=await PrivateDelivery.findOneAndUpdate({_id:id,userId},{$set:{paymentLocked:true}},{new:true});
 if(!delivery)throw new HttpError(404,'Entrega não encontrada');
 // Bloqueio persistente antes de registrar o pagamento impede edição simultânea.
 // Se a criação da receita falhar, repetir o pedido confirma o mesmo valor sem duplicidade.
 // O próprio usuário confirma recebimento fora do MotoPRO; não movimenta Pix.
 // O índice exclusivo Entry.userId+provider+externalId garante idempotência inclusive em solicitações simultâneas.
 const externalId=String(delivery._id);
 const payload={userId,source:'private' as const,provider:'private',externalId,type:'income' as const,category:'delivery',
  description:delivery.description||'Entrega particular',amountCents:delivery.amountCents,
  // Regime de caixa: contabilizar a receita na data da confirmação do recebimento.
  occurredOn:dateInTimezone('America/Belem')};
 let created=false;
 try{
  const result=await Entry.updateOne({userId,provider:'private',externalId},{$setOnInsert:payload},{upsert:true,runValidators:true});
  created=result.upsertedCount>0;
 }catch(e){
  if(!(e instanceof Error && /E11000|duplicate key/i.test(e.message)))throw e;
 }
 res.setHeader('Cache-Control','private, no-store');
 res.json({ok:true,created,paymentStatus:'paid',message:created?'Recebimento incluído nos ganhos.':'Pagamento já estava registrado; não houve duplicidade.'});
}));
