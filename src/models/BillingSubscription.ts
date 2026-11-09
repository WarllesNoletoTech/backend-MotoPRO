import mongoose from 'mongoose';

export interface SubscriptionFields {
  userId: mongoose.Types.ObjectId;
  method: 'pix'|'credit';
  priceCents?: number;
  status: 'pending'|'active'|'canceled'|'expired';
  providerSubscriptionId?: string;
  activeUntil?: Date;
  cancelAtPeriodEnd: boolean;
  appliedPaymentIds: string[];
}
const schema = new mongoose.Schema<SubscriptionFields>({
  userId: {type: mongoose.Schema.Types.ObjectId, ref:'User', required:true, unique:true},
  method: {type:String, enum:['pix','credit'], required:true},
  priceCents:{type:Number,min:199,default:999},
  status: {type:String, enum:['pending','active','canceled','expired'], default:'pending'},
  providerSubscriptionId: {type:String, index:true, sparse:true},
  activeUntil: Date,
  cancelAtPeriodEnd: {type:Boolean, default:false},
  appliedPaymentIds: {type:[String], default:[]}
}, {timestamps:true});
export const BillingSubscription: mongoose.Model<SubscriptionFields> =
  (mongoose.models.BillingSubscription as mongoose.Model<SubscriptionFields> | undefined) ??
  mongoose.model<SubscriptionFields>('BillingSubscription', schema);
