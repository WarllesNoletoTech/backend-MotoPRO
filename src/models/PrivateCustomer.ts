import mongoose from 'mongoose';

export interface PrivateCustomerFields {
 userId:mongoose.Types.ObjectId;
 name:string;
 phone?:string;
 notes?:string;
 archived:boolean;
 erasedAt?:Date;
}
const schema=new mongoose.Schema<PrivateCustomerFields>({
 userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 name:{type:String,required:true,trim:true,minlength:2,maxlength:90},
 phone:{type:String,trim:true,maxlength:16},
 notes:{type:String,trim:true,maxlength:300,default:''},
 archived:{type:Boolean,default:false},
 erasedAt:{type:Date,default:undefined}
},{timestamps:true});
schema.index({userId:1,archived:1,name:1});
export const PrivateCustomer:mongoose.Model<PrivateCustomerFields>=
 (mongoose.models.PrivateCustomer as mongoose.Model<PrivateCustomerFields>|undefined)??
 mongoose.model<PrivateCustomerFields>('PrivateCustomer',schema);
