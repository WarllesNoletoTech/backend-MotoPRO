import mongoose from 'mongoose';
const {Schema,model,models}=mongoose;
const schema=new Schema({
 userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 endpoint:{type:String,required:true,maxlength:1800,unique:true},
 keys:{p256dh:{type:String,required:true},auth:{type:String,required:true}},
 enabled:{type:Boolean,default:true},
 lastSentAt:{type:Date,default:null},
 lastError:{type:String,default:null,maxlength:80}
},{timestamps:true});
schema.index({userId:1,enabled:1});
export const PushSubscription=models.PushSubscription||model('PushSubscription',schema);
