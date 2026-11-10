import mongoose from 'mongoose';

export interface ReferralRewardFields {
 referrerId:mongoose.Types.ObjectId;
 referredUserId:mongoose.Types.ObjectId;
 firstPaymentId:mongoose.Types.ObjectId;
 amountCents:number;
 status:'available'|'paid'|'reversed';
 paidAt?:Date;
 paidBy?:mongoose.Types.ObjectId;
 payoutNote?:string;
 reversedAt?:Date;
 createdAt?:Date;
 updatedAt?:Date;
}
const schema=new mongoose.Schema<ReferralRewardFields>({
 referrerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 referredUserId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,unique:true},
 firstPaymentId:{type:mongoose.Schema.Types.ObjectId,ref:'BillingPayment',required:true},
 amountCents:{type:Number,required:true,default:500,min:500,max:500},
 status:{type:String,enum:['available','paid','reversed'],required:true,default:'available'},
 paidAt:Date,
 paidBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
 payoutNote:{type:String,maxlength:240},
 reversedAt:Date
},{timestamps:true});
schema.index({referrerId:1,createdAt:-1});
export const ReferralReward:mongoose.Model<ReferralRewardFields> =
 (mongoose.models.ReferralReward as mongoose.Model<ReferralRewardFields>|undefined)??mongoose.model<ReferralRewardFields>('ReferralReward',schema);
