import mongoose from 'mongoose';
const {Schema,model,models}=mongoose;
const schema=new Schema({
 userId:{type:Schema.Types.ObjectId,ref:'User',required:true},
 provider:{type:String,default:'rappidex',enum:['rappidex'],required:true},
 remoteUserId:{type:String,required:true},remoteName:{type:String,required:true,maxlength:110},
 lastSyncAt:{type:Date,default:null},syncLockUntil:{type:Date,default:null},syncLockToken:{type:String,default:null},
},{timestamps:true});
schema.index({userId:1,provider:1},{unique:true});
schema.index({provider:1,remoteUserId:1},{unique:true});
export const IntegrationConnection=models.IntegrationConnection||model('IntegrationConnection',schema);
