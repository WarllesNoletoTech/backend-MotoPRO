import mongoose from 'mongoose';
export interface AdminAuditFields {
 actorId:mongoose.Types.ObjectId;
 action:string;
 targetId?:mongoose.Types.ObjectId;
 metadata?:Record<string,string|number|boolean|null>;
}
const schema=new mongoose.Schema<AdminAuditFields>({
 actorId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 action:{type:String,required:true,maxlength:70},
 targetId:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
 metadata:{type:mongoose.Schema.Types.Mixed,default:{}}
},{timestamps:true});
export const AdminAudit:mongoose.Model<AdminAuditFields>=
 (mongoose.models.AdminAudit as mongoose.Model<AdminAuditFields>|undefined)??mongoose.model<AdminAuditFields>('AdminAudit',schema);
