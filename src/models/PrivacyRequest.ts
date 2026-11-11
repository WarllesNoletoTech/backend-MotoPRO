import mongoose from 'mongoose';
const {Schema,model,models}=mongoose;
const schema=new Schema({
 userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 type:{type:String,enum:['deletion','correction'],required:true},
 note:{type:String,maxlength:500,default:''},
 status:{type:String,enum:['open','resolved'],default:'open'},
 response:{type:String,maxlength:500,default:''},
 resolvedAt:{type:Date,default:null}
},{timestamps:true});
schema.index({userId:1,type:1},{unique:true,partialFilterExpression:{status:'open'}});
export const PrivacyRequest=models.PrivacyRequest||model('PrivacyRequest',schema);
