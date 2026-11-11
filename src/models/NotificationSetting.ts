import mongoose from 'mongoose';

export const notificationKinds=['summary','maintenance','recurring','receivables','subscription'] as const;
export type NotificationKind=typeof notificationKinds[number];
export type NotificationTemplate={title:string;body:string};
export type NotificationSettings={enabled:boolean;categories:Record<Exclude<NotificationKind,'summary'>,boolean>;templates:Record<NotificationKind,NotificationTemplate>};
export const notificationDefaults:NotificationSettings={
 enabled:true,
 categories:{maintenance:true,recurring:true,receivables:true,subscription:true},
 templates:{
  summary:{title:'MotoPRO · Seus avisos',body:'Você tem {quantidade} aviso(s) para conferir no aplicativo.'},
  maintenance:{title:'MotoPRO · Cuide da sua moto',body:'Há uma manutenção próxima ou vencida. Abra o MotoPRO para conferir.'},
  recurring:{title:'MotoPRO · Despesas programadas',body:'Uma despesa recorrente precisa da sua atenção. Consulte o MotoPRO.'},
  receivables:{title:'MotoPRO · Entregas a receber',body:'Existem entregas particulares com recebimento pendente. Confira no aplicativo.'},
  subscription:{title:'MotoPRO · Sua assinatura',body:'Seu acesso Premium está perto do vencimento. Confira sua assinatura no aplicativo.'}
 }
};
const templateSchema=new mongoose.Schema({title:{type:String,required:true,maxlength:75},body:{type:String,required:true,maxlength:180}},{_id:false});
const schema=new mongoose.Schema({
 key:{type:String,default:'global',unique:true,required:true},
 enabled:{type:Boolean,default:true},
 categories:{
  maintenance:{type:Boolean,default:true},
  recurring:{type:Boolean,default:true},
  receivables:{type:Boolean,default:true},
  subscription:{type:Boolean,default:true}
 },
 templates:{
  summary:{type:templateSchema,default:()=>({...notificationDefaults.templates.summary})},
  maintenance:{type:templateSchema,default:()=>({...notificationDefaults.templates.maintenance})},
  recurring:{type:templateSchema,default:()=>({...notificationDefaults.templates.recurring})},
  receivables:{type:templateSchema,default:()=>({...notificationDefaults.templates.receivables})},
  subscription:{type:templateSchema,default:()=>({...notificationDefaults.templates.subscription})}
 }
},{timestamps:true});
export const NotificationSetting=mongoose.models.NotificationSetting||mongoose.model('NotificationSetting',schema);
export async function getNotificationSettings():Promise<NotificationSettings>{
 const value=await NotificationSetting.findOne({key:'global'}).lean() as Record<string,unknown>|null;
 const settings=notificationDefaults;
 const c=(value?.categories||{}) as Record<string,unknown>;
 const t=(value?.templates||{}) as Record<string,{title?:string;body?:string}>;
 return {enabled:typeof value?.enabled==='boolean'?value.enabled:true,
  categories:{maintenance:typeof c.maintenance==='boolean'?c.maintenance:settings.categories.maintenance,
   recurring:typeof c.recurring==='boolean'?c.recurring:settings.categories.recurring,
   receivables:typeof c.receivables==='boolean'?c.receivables:settings.categories.receivables,
   subscription:typeof c.subscription==='boolean'?c.subscription:settings.categories.subscription},
  templates:Object.fromEntries(notificationKinds.map(kind=>[kind,{
   title:typeof t[kind]?.title==='string'?t[kind].title:settings.templates[kind].title,
   body:typeof t[kind]?.body==='string'?t[kind].body:settings.templates[kind].body
  }])) as NotificationSettings['templates']};
}
