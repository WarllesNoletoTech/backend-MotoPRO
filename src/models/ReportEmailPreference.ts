import mongoose from 'mongoose';
const {Schema,model,models}=mongoose;
const schema=new Schema({
 userId:{type:Schema.Types.ObjectId,ref:'User',required:true,unique:true,index:true},
 email:{type:String,required:true,trim:true,lowercase:true},
 enabled:{type:Boolean,default:false,index:true},
 verifiedAt:{type:Date,default:null},
 verificationHash:{type:String,select:false,default:null},
 verificationExpiresAt:{type:Date,select:false,default:null},
 lastVerificationSentAt:{type:Date,default:null}
},{timestamps:true});
export const ReportEmailPreference=models.ReportEmailPreference||model('ReportEmailPreference',schema);
