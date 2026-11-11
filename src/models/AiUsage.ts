import mongoose from 'mongoose';
const {model,models,Schema}=mongoose;
const schema=new Schema({
 userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 feature:{type:String,enum:['transcription','interpretation','receipt'],required:true},
 outcome:{type:String,enum:['success','failed','fallback'],required:true},
 model:{type:String,maxlength:80,default:''},
 inputTokens:{type:Number,min:0,default:0},outputTokens:{type:Number,min:0,default:0},
 estimatedUsd:{type:Number,min:0,default:null}
},{timestamps:true});
schema.index({createdAt:-1,feature:1});
// Conteúdo de voz e fotos nunca é armazenado aqui.
export const AiUsage=models.AiUsage||model('AiUsage',schema);
