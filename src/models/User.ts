import mongoose from 'mongoose';
const { model, models, Schema } = mongoose;
const schema = new Schema({
  name:{type:String,required:true,trim:true,maxlength:90},
  email:{type:String,required:true,trim:true,lowercase:true,unique:true,index:true},
  passwordHash:{type:String,required:true,select:false},
  role:{type:String,enum:['driver','admin'],default:'driver'},
  blockedAt:{type:Date,default:null},
  blockReason:{type:String,default:'',maxlength:240},
  lastLoginAt:{type:Date,default:null},
  timezone:{type:String,default:'America/Belem'},
  // Para usuários antigos pode estar ausente até completar o cadastro.
  phone:{type:String,trim:true,default:null,maxlength:16},
  // Campo legado. A autorização SEMPRE usa createdAt + dias atuais definidos pelo admin.
  trialEndsAt:{type:Date,default:null}
},{timestamps:true});
// Limita o banco a uma única conta de administrador.
schema.index({role:1},{unique:true,partialFilterExpression:{role:'admin'},name:'singleton_admin'});
export const User=models.User || model('User',schema);
