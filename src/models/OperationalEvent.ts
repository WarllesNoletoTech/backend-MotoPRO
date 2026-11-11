import mongoose from 'mongoose';
const {Schema,model,models}=mongoose;
// Não registra IP, URL completa, parâmetros, corpo, credenciais ou identificadores de usuário.
const schema=new Schema({
 kind:{type:String,enum:['error','slow'],required:true},
 method:{type:String,required:true,maxlength:8},
 route:{type:String,required:true,maxlength:150},
 status:{type:Number,required:true,min:100,max:599},
 durationMs:{type:Number,required:true,min:0,max:600000},
 requestId:{type:String,maxlength:36},
 at:{type:Date,default:Date.now,expires:7*24*60*60}
},{versionKey:false});
schema.index({at:-1,kind:1});
export const OperationalEvent=models.OperationalEvent||model('OperationalEvent',schema);
