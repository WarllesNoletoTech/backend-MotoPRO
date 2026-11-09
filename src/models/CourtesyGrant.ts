import mongoose from 'mongoose';
export interface CourtesyGrantFields {
 userId:mongoose.Types.ObjectId;
 activeUntil:Date;
 lastGrantedAt:Date;
 lastGrantedBy:mongoose.Types.ObjectId;
 reason:string;
}
const schema=new mongoose.Schema<CourtesyGrantFields>({
 userId:{type:mongoose.Schema.Types.ObjectId,required:true,unique:true,ref:'User'},
 activeUntil:{type:Date,required:true,index:true},
 lastGrantedAt:{type:Date,required:true},
 lastGrantedBy:{type:mongoose.Schema.Types.ObjectId,required:true,ref:'User'},
 reason:{type:String,required:true,maxlength:240}
},{timestamps:true});
export const CourtesyGrant:mongoose.Model<CourtesyGrantFields>=
 (mongoose.models.CourtesyGrant as mongoose.Model<CourtesyGrantFields>|undefined)??mongoose.model<CourtesyGrantFields>('CourtesyGrant',schema);
