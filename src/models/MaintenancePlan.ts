import mongoose from 'mongoose';
const {model,models,Schema}=mongoose;
const schema=new Schema({
 userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 label:{type:String,required:true,trim:true,maxlength:120},
 intervalKm:{type:Number,min:100,max:100_000},intervalDays:{type:Number,min:1,max:3650},
 lastServiceKm:{type:Number,min:0,max:2_000_000},lastServiceOn:{type:String,match:/^\d{4}-\d{2}-\d{2}$/},
 enabled:{type:Boolean,default:true},
 lastCompletedAt:{type:Date}
},{timestamps:true});
export const MaintenancePlan=models.MaintenancePlan||model('MaintenancePlan',schema);
