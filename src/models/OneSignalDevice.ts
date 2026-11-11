import mongoose from 'mongoose';
const {Schema,model,models}=mongoose;
// Guarda apenas o identificador técnico de uma assinatura ativada com consentimento.
const schema=new Schema({
 userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 subscriptionId:{type:String,required:true,unique:true,maxlength:80},
 enabled:{type:Boolean,default:true},
 lastSeenAt:{type:Date,default:Date.now},
},{timestamps:true});
schema.index({userId:1,enabled:1});
export const OneSignalDevice=models.OneSignalDevice||model('OneSignalDevice',schema);
