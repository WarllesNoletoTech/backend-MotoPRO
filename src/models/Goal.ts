import mongoose from 'mongoose';
const { model, models, Schema } = mongoose;
const schema = new Schema({
  userId:{type:Schema.Types.ObjectId,ref:'User',unique:true,required:true},
  weeklyTargetCents:{type:Number,required:true,min:100,max:100_000_000}
},{timestamps:true});
export const Goal=models.Goal||model('Goal',schema);
