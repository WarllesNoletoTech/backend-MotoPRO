import mongoose from 'mongoose';
export interface RewardCampaignFields {
 title:string;
 description:string;
 reward:string;
 objectiveCriteria:string;
 status:'draft'|'published'|'closed';
 startsAt?:Date;
 endsAt?:Date;
 approvedTermsReference?:string;
 resultSummary?:string;
 createdBy:mongoose.Types.ObjectId;
}
const schema=new mongoose.Schema<RewardCampaignFields>({
 title:{type:String,required:true,trim:true,maxlength:100},
 description:{type:String,required:true,trim:true,maxlength:1200},
 reward:{type:String,required:true,trim:true,maxlength:250},
 objectiveCriteria:{type:String,required:true,trim:true,maxlength:650},
 status:{type:String,enum:['draft','published','closed'],default:'draft'},
 startsAt:Date,endsAt:Date,
 approvedTermsReference:{type:String,trim:true,maxlength:250},
 resultSummary:{type:String,trim:true,maxlength:500},
 createdBy:{type:mongoose.Schema.Types.ObjectId,required:true,ref:'User'}
},{timestamps:true});
export const RewardCampaign:mongoose.Model<RewardCampaignFields>=
 (mongoose.models.RewardCampaign as mongoose.Model<RewardCampaignFields>|undefined)??
 mongoose.model<RewardCampaignFields>('RewardCampaign',schema);
