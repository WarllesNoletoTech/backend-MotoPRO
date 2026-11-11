import mongoose from 'mongoose';
const {Schema,model,models}=mongoose;
const schema=new Schema({
 userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 periodFrom:{type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},
 periodTo:{type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},
 status:{type:String,enum:['pending','sending','sent','failed'],default:'pending'},
 attempts:{type:Number,default:0,min:0},
 claimedAt:{type:Date,default:null},
 sentAt:{type:Date,default:null},
 providerMessageId:{type:String,default:null},
 lastError:{type:String,default:null,maxlength:200}
},{timestamps:true});
schema.index({userId:1,periodFrom:1},{unique:true});
schema.index({status:1,createdAt:-1});
export const WeeklyReportDelivery=models.WeeklyReportDelivery||model('WeeklyReportDelivery',schema);
