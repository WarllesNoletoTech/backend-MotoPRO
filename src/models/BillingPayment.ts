import mongoose from 'mongoose';

export interface PaymentFields {
  createdAt?:Date;
  updatedAt?:Date;
  userId: mongoose.Types.ObjectId;
  method: 'pix'|'credit';
  status: 'pending'|'approved'|'rejected'|'refunded'|'canceled';
  amountCents: number;
  providerPaymentId?: string;
  providerSubscriptionId?: string;
  idempotencyKey: string;
  pixCode?: string;
  pixQrBase64?: string;
  pixTicketUrl?: string;
  expiresAt?: Date;
  paidAt?: Date;
}
const schema = new mongoose.Schema<PaymentFields>({
  userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  method:{type:String,enum:['pix','credit'],required:true},
  status:{type:String,enum:['pending','approved','rejected','refunded','canceled'],default:'pending'},
  amountCents:{type:Number,required:true},
  providerPaymentId:{type:String,unique:true,sparse:true},
  providerSubscriptionId:{type:String},
  idempotencyKey:{type:String,required:true,unique:true},
  pixCode:String,pixQrBase64:String,pixTicketUrl:String,expiresAt:Date,paidAt:Date
},{timestamps:true});
export const BillingPayment: mongoose.Model<PaymentFields> =
  (mongoose.models.BillingPayment as mongoose.Model<PaymentFields>|undefined) ??
  mongoose.model<PaymentFields>('BillingPayment',schema);
