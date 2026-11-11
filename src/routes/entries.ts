import {Router} from 'express';
import {z} from 'zod';
import {Entry} from '../models/Entry.js';
import {uid} from '../services/auth.js';
import {asyncRoute,HttpError,validId} from '../utils/http.js';
import {isValidDateOnly} from '../utils/dates.js';
export const entriesRouter=Router();
const schema=z.object({
  type:z.enum(['income','expense']),
  category:z.enum(['delivery','bonus','fuel','maintenance','food','other']),
  amountCents:z.number().int().positive().max(100_000_000),
  description:z.string().trim().max(160).default(''),
  occurredOn:z.string().refine(isValidDateOnly,'Data inválida'),
  source:z.enum(['manual','voice','receipt']).default('manual'),
  platform:z.enum(['rappidex','ifood','uber','99','other']).optional(),
  fuelLiters:z.number().positive().max(200).optional(),
  odometerKm:z.number().nonnegative().max(2_000_000).optional(),
  fuelType:z.enum(['gasolina','etanol','diesel','outro']).optional(),
  fuelStation:z.string().trim().max(100).optional()
}).superRefine((v,ctx)=>{
  if(v.type==='income'&&!['delivery','bonus','other'].includes(v.category))ctx.addIssue({code:'custom',path:['category'],message:'Categoria incompatível com receita'});
  if(v.type==='expense'&&['delivery','bonus'].includes(v.category))ctx.addIssue({code:'custom',path:['category'],message:'Categoria incompatível com despesa'});
  if(v.type==='expense' && v.platform!==undefined)ctx.addIssue({code:'custom',path:['platform'],message:'Plataforma aplica-se apenas a receitas'});
  if(v.category!=='fuel'&&(v.fuelLiters!==undefined||v.fuelType!==undefined||v.fuelStation))ctx.addIssue({code:'custom',path:['category'],message:'Detalhes de abastecimento exigem categoria Combustível'});
});
const patchSchema=schema.innerType().partial();
entriesRouter.get('/export',asyncRoute(async(req,res)=>{
 const items=await Entry.find({userId:uid(req)}).sort({occurredOn:-1}).limit(10_000).lean();
 const csvCell=(v:unknown)=>{
   const value=String(v??'');
   const safe=/^[=+@-]/.test(value)?`'${value}`:value;
   return `"${safe.replace(/"/g,'""')}"`;
 };
 const columns=['Data','Tipo','Categoria','Descricao','Valor (R$)','Origem','Plataforma','Litros','Quilometragem','Combustivel','Posto'];
 const rows=items.map(i=>[i.occurredOn,i.type,i.category,i.description,(i.amountCents/100).toFixed(2).replace('.',','),i.source,i.platform||i.provider||'',i.fuelLiters??'',i.odometerKm??'',i.fuelType??'',i.fuelStation??''].map(csvCell).join(';'));
 res.setHeader('Content-Type','text/csv; charset=utf-8');
 res.setHeader('Content-Disposition','attachment; filename="motopro-lancamentos.csv"');
 res.send('\ufeff'+[columns.join(';'),...rows].join('\r\n'));
}));
entriesRouter.get('/',asyncRoute(async(req,res)=>{
  const page=Math.max(1,Math.min(1000,Number(req.query.page)||1));
  const limit=Math.max(1,Math.min(100,Number(req.query.limit)||20));
  const filter:Record<string,unknown>={userId:uid(req)};
  if(req.query.type==='income'||req.query.type==='expense')filter.type=req.query.type;
  if(req.query.from||req.query.to){
    const from=String(req.query.from||'0001-01-01'),to=String(req.query.to||'9999-12-31');
    if(!isValidDateOnly(from)||!isValidDateOnly(to)||from>to)throw new HttpError(400,'Período inválido');
    filter.occurredOn={$gte:from,$lte:to};
  }
  const [items,total]=await Promise.all([
    Entry.find(filter).sort({occurredOn:-1,createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),
    Entry.countDocuments(filter)
  ]);
  res.json({items,total,page,limit});
}));
entriesRouter.post('/',asyncRoute(async(req,res)=>{
  const data=schema.parse(req.body);
  if(data.source==='receipt')throw new HttpError(403,'Use a confirmação da leitura de comprovante');
  const entry=await Entry.create({userId:uid(req),...data});
  res.status(201).json({entry});
}));
entriesRouter.patch('/:id',asyncRoute(async(req,res)=>{
  if(!validId(req.params.id))throw new HttpError(400,'ID inválido');
  const patch=patchSchema.parse(req.body);
  const current=await Entry.findOne({_id:req.params.id,userId:uid(req)});
  if(!current)throw new HttpError(404,'Lançamento não encontrado');
  if(current.source==='integration'||current.source==='private')throw new HttpError(403,'Registros importados e entregas particulares recebidas não podem ser editados aqui');
  if(patch.source!==undefined&&patch.source!==current.source)throw new HttpError(403,'Não é possível alterar a origem do lançamento');
  const candidate={...current.toObject(),...patch};
  if(patch.type==='expense')delete candidate.platform;
  if(patch.category&&patch.category!=='fuel'){delete candidate.fuelLiters;delete candidate.fuelType;delete candidate.fuelStation;}
  const merged=schema.parse(candidate);
  for(const key of ['type','category','amountCents','description','occurredOn','source','platform','fuelLiters','odometerKm','fuelType','fuelStation'] as const){
    if(key in merged)current.set(key,merged[key]);
  }
  if(patch.type==='expense')current.set('platform',undefined);
  if(patch.category&&patch.category!=='fuel'){current.set('fuelLiters',undefined);current.set('fuelType',undefined);current.set('fuelStation',undefined);}
  await current.save();res.json({entry:current});
}));
entriesRouter.delete('/:id',asyncRoute(async(req,res)=>{
  if(!validId(req.params.id))throw new HttpError(400,'ID inválido');
  const entry=await Entry.findOne({_id:req.params.id,userId:uid(req)});
  if(!entry)throw new HttpError(404,'Lançamento não encontrado');
  if(entry.source==='integration'||entry.source==='private')throw new HttpError(403,'Não é possível excluir importações nem entregas particulares recebidas por aqui');
  await entry.deleteOne();res.json({ok:true});
}));
