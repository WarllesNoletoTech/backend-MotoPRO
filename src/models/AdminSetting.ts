import mongoose from 'mongoose';

export interface AdminSettingFields {
  key: string;
  weeklyPriceCents: number;
  trialDays: number;
  newRegistrationsOpen: boolean;
  announcement: string;
  premiumBenefits: string[];
  maintenanceNotice: string;
}
const schema = new mongoose.Schema<AdminSettingFields>({
  key:{type:String,required:true,unique:true,default:'global'},
  weeklyPriceCents:{type:Number,min:199,max:99900,default:999},
  trialDays:{type:Number,min:0,max:30,default:7},
  newRegistrationsOpen:{type:Boolean,default:true},
  announcement:{type:String,default:'',maxlength:500},
  premiumBenefits:{type:[String],default:['Assistente inteligente','Controle financeiro','Gestão da moto']},
  maintenanceNotice:{type:String,default:'',maxlength:500}
},{timestamps:true});
export const AdminSetting: mongoose.Model<AdminSettingFields> =
 (mongoose.models.AdminSetting as mongoose.Model<AdminSettingFields>|undefined) ??
 mongoose.model<AdminSettingFields>('AdminSetting',schema);
export async function getAdminSettings(){
 const settings=await AdminSetting.findOne({key:'global'}).lean();
 return {weeklyPriceCents:settings?.weeklyPriceCents??999,trialDays:settings?.trialDays??7,
  newRegistrationsOpen:settings?.newRegistrationsOpen??true,announcement:settings?.announcement??'',
  premiumBenefits:settings?.premiumBenefits??['Assistente inteligente','Controle financeiro','Gestão da moto'],
  maintenanceNotice:settings?.maintenanceNotice??''};
}
