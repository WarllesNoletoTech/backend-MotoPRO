import mongoose from 'mongoose';
const {Schema,model,models}=mongoose;
const schema=new Schema({
 userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 label:{type:String,trim:true,required:true,maxlength:100},
 category:{type:String,enum:['fuel','maintenance','food','other'],required:true},
 amountCents:{type:Number,required:true,min:1,max:100_000_000,validate:Number.isSafeInteger},
 dayOfMonth:{type:Number,required:true,min:1,max:31},
 startMonth:{type:String,required:true,match:/^\d{4}-(0[1-9]|1[0-2])$/},
 enabled:{type:Boolean,default:true}
},{timestamps:true});
schema.index({userId:1,enabled:1,createdAt:-1});
export const RecurringExpense=models.RecurringExpense||model('RecurringExpense',schema);
