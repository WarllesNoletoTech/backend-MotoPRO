import mongoose from 'mongoose';
const { model, models, Schema } = mongoose;
const schema = new Schema({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  type:{type:String,enum:['income','expense'],required:true},
  category:{type:String,enum:['delivery','bonus','fuel','maintenance','food','other'],required:true},
  description:{type:String,trim:true,maxlength:160,default:''},
  amountCents:{type:Number,required:true,min:1,max:100_000_000,validate:Number.isSafeInteger},
  occurredOn:{type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},
  source:{type:String,enum:['manual','voice','integration'],default:'manual'},
  provider:{type:String,trim:true},externalId:{type:String,trim:true},
  fuelLiters:{type:Number,min:0},odometerKm:{type:Number,min:0}
},{timestamps:true});
schema.index({userId:1,occurredOn:-1,createdAt:-1});
schema.index({userId:1,provider:1,externalId:1},{unique:true,partialFilterExpression:{externalId:{$type:'string'}}});
export const Entry=models.Entry||model('Entry',schema);
