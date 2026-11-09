/**
 * MotoPRO: cria ou promove um único usuário administrador a partir do terminal.
 * Não há rota pública de promoção, senha pré-definida nem credenciais versionadas.
 * Execução: npm run admin:create (terminal interativo do Heroku / Windows).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, stderr } from 'node:process';

const mongoUri = process.env.MONGODB_URI || '';
if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
  stderr.write('Configure MONGODB_URI antes de criar o admin.\n');
  process.exit(1);
}

async function askBasics() {
  const rl=createInterface({input:stdin,output:stdout});
  try {
    const email=(process.env.ADMIN_EMAIL || await rl.question('E-mail do administrador: ')).trim().toLowerCase();
    const name=(process.env.ADMIN_NAME || await rl.question('Nome do administrador: ')).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>180) throw new Error('E-mail inválido');
    if (name.length<2 || name.length>90) throw new Error('Nome deve conter entre 2 e 90 caracteres');
    return {email,name};
  } finally {rl.close();}
}
function readSecret(label) {
  if (!stdin.isTTY || typeof stdin.setRawMode!=='function') throw new Error('Um terminal interativo é necessário para digitar a senha com segurança. Use o Heroku CLI em um terminal, não um comando automatizado.');
  return new Promise((resolve,reject)=>{
    stdout.write(label);
    let value='';
    const previousRaw=stdin.isRaw;
    stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');
    const finish=(error)=>{
      stdin.off('data',onData);
      stdin.setRawMode(!!previousRaw);
      stdin.pause();stdout.write('\n');
      if(error)reject(error);else resolve(value);
    };
    const onData=(data)=>{
      for (const character of data) {
        if(character==='\u0003'){finish(new Error('Operação cancelada'));return;}
        if(character==='\r'||character==='\n'){finish();return;}
        if(character==='\u007f'||character==='\b'){value=value.slice(0,-1);continue;}
        if(character.charCodeAt(0)>=32 && value.length<256)value+=character;
      }
    };
    stdin.on('data',onData);
  });
}
async function confirmPromotion(existingEmail, currentRole) {
  const rl=createInterface({input:stdin,output:stdout});
  try {
    const answer=await rl.question(`Conta existente (${existingEmail}; perfil ${currentRole}). Para promover e redefinir senha, digite PROMOVER: `);
    if (answer.trim()!=='PROMOVER') throw new Error('Operação cancelada; conta mantida sem alterações');
  } finally {rl.close();}
}

async function main(){
  const {email,name}=await askBasics();
  await mongoose.connect(mongoUri,{serverSelectionTimeoutMS:15000});
  const schema=new mongoose.Schema({name:String,email:String,passwordHash:{type:String,select:false},role:String,timezone:String,trialEndsAt:Date},{strict:false});
  const User=mongoose.models.User || mongoose.model('User',schema,'users');
  const existing=await User.findOne({email}).select('+passwordHash role name');
  if(existing) await confirmPromotion(email,String(existing.role||'driver'));
  const password=await readSecret('Nova senha de administrador (mínimo 12 caracteres; não aparece na tela): ');
  const repeated=await readSecret('Confirme a senha: ');
  if(password!==repeated)throw new Error('As senhas não coincidem');
  if(password.length<12 || password.length>128)throw new Error('Use uma senha entre 12 e 128 caracteres');
  const passwordHash=await bcrypt.hash(password,12);
  if(existing){
    await User.updateOne({_id:existing._id},{$set:{name,role:'admin',passwordHash}});
    stdout.write('Conta existente promovida a admin e senha atualizada.\n');
  }else{
    try{await User.create({name,email,role:'admin',passwordHash,timezone:'America/Belem'});}
    catch(error){if(error?.code===11000)throw new Error('Já existe uma conta com este e-mail. Execute novamente para promovê-la.');throw error;}
    stdout.write('Conta de administrador criada.\n');
  }
  stdout.write(`Acesso: https://frontend-moto-pro.vercel.app/entrar | e-mail: ${email}\n`);
  stdout.write('Não compartilhe a senha. Após entrar, abra /app/admin.\n');
}
main().catch(error=>{stderr.write(`Erro ao configurar admin: ${error instanceof Error?error.message:String(error)}\n`);process.exitCode=1;}).finally(async()=>{await mongoose.disconnect().catch(()=>{});});
