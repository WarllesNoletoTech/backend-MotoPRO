import mongoose from 'mongoose';
const { model, models, Schema } = mongoose;
const schema = new Schema({
  name:{type:String,required:true,trim:true,maxlength:90},
  email:{type:String,required:true,trim:true,lowercase:true,unique:true,index:true},
  passwordHash:{type:String,required:true,select:false},
  role:{type:String,enum:['driver','admin'],default:'driver'},
  timezone:{type:String,default:'America/Belem'},
  trialEndsAt:{type:Date,default:()=>new Date(Date.now()+7*86400_000)}
},{timestamps:true});
export const User=models.User || model('User',schema);
