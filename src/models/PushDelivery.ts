import mongoose from 'mongoose';
const {Schema,model,models}=mongoose;
const schema=new Schema({
 userId:{type:Schema.Types.ObjectId,ref:'User',required:true},
 date:{type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},
 status:{type:String,enum:['pending','sending','sent','failed'],default:'pending'},
 claimedAt:{type:Date,default:null},
 sentAt:{type:Date,default:null},
 attempts:{type:Number,default:0},
 count:{type:Number,default:0}
},{timestamps:true});
schema.index({userId:1,date:1},{unique:true});
schema.index({createdAt:1},{expireAfterSeconds:60*86400});
export const PushDelivery=models.PushDelivery||model('PushDelivery',schema);
