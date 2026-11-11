import mongoose from 'mongoose';

// O pagamento é determinado pelo lançamento do financeiro com
// provider='private' e externalId=<ID da entrega>. Não há saldo duplicado.
export interface PrivateDeliveryFields {
 userId:mongoose.Types.ObjectId;
 customerId:mongoose.Types.ObjectId|null;
 description:string;
 amountCents:number;
 deliveredOn:string;
 paymentLocked?:boolean;
}
const schema=new mongoose.Schema<PrivateDeliveryFields>({
 userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 customerId:{type:mongoose.Schema.Types.ObjectId,ref:'PrivateCustomer',default:null,index:true},
 description:{type:String,trim:true,maxlength:160,default:''},
 amountCents:{type:Number,required:true,min:1,max:100_000_000,validate:Number.isSafeInteger},
 deliveredOn:{type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},
 paymentLocked:{type:Boolean,default:false}
},{timestamps:true});
schema.index({userId:1,deliveredOn:-1,createdAt:-1});
export const PrivateDelivery:mongoose.Model<PrivateDeliveryFields>=
 (mongoose.models.PrivateDelivery as mongoose.Model<PrivateDeliveryFields>|undefined)??
 mongoose.model<PrivateDeliveryFields>('PrivateDelivery',schema);
