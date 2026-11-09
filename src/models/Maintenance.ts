import mongoose from 'mongoose';
const { model, models, Schema } = mongoose;
const schema = new Schema({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  label:{type:String,required:true,trim:true,maxlength:120},
  dueOn:{type:String,match:/^\d{4}-\d{2}-\d{2}$/},
  dueKm:{type:Number,min:0,max:2_000_000},
  done:{type:Boolean,default:false}
},{timestamps:true});
export const Maintenance=models.Maintenance||model('Maintenance',schema);
