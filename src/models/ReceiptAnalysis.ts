import mongoose from 'mongoose';
const {models,model,Schema}=mongoose;
const schema=new Schema({
 userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 fingerprint:{type:String,required:true,match:/^[a-f0-9]{64}$/},
 suggestion:{type:Schema.Types.Mixed,required:true},
 confirmedEntryId:{type:Schema.Types.ObjectId,ref:'Entry',default:null},
 expiresAt:{type:Date,required:true,default:()=>new Date(Date.now()+30*86400000)}
},{timestamps:true});
schema.index({userId:1,fingerprint:1},{unique:true});
schema.index({expiresAt:1},{expireAfterSeconds:0});
// Só hash da imagem e sugestão financeira são mantidos; os bytes da foto são descartados.
export const ReceiptAnalysis=models.ReceiptAnalysis||model('ReceiptAnalysis',schema);
