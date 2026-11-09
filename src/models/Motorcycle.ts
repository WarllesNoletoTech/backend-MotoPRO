import mongoose from 'mongoose';
const { model, models, Schema } = mongoose;
const schema = new Schema({
  userId:{type:Schema.Types.ObjectId,ref:'User',unique:true,required:true},
  model:{type:String,maxlength:100,trim:true,required:true},
  year:{type:Number,min:1980,max:2100},
  odometerKm:{type:Number,min:0,max:2_000_000,default:0},
  kmPerLiter:{type:Number,min:1,max:150}
},{timestamps:true});
export const Motorcycle=models.Motorcycle||model('Motorcycle',schema);
