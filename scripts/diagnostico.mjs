import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || '';
const secret = process.env.JWT_SECRET || '';
console.log('MotoPRO - diagnostico de configuracao');
console.log(`JWT: ${secret.length} caracteres`);
console.log(`URI definida: ${uri.length > 0 ? 'sim' : 'nao'}`);
console.log(`Cluster de destino: ${(() => { try { return new URL(uri.replace(/^mongodb\+srv:/, 'https:')).hostname; } catch { return '(invalido)'; } })()}`);
if (secret.length < 32) {
  console.error('ERRO: JWT_SECRET precisa ter no minimo 32 caracteres. Execute CONFIGURAR_WINDOWS.bat.');
  process.exitCode = 1;
} else if (!/^mongodb(\+srv)?:\/\//.test(uri) || /SEU-CLUSTER|HOST_REAL_DO_ATLAS|USUARIO:SENHA|<db_password>/i.test(uri)) {
  console.error('ERRO: MongoDB URI incompleta. Execute CONFIGURAR_WINDOWS.bat.');
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(uri, {serverSelectionTimeoutMS: 10000});
    await mongoose.connection.db.admin().ping();
    console.log('SUCESSO: MongoDB Atlas conectado e respondendo.');
  } catch (error) {
    console.error('Falha ao conectar ao MongoDB:', error?.message || String(error));
    console.error('Confira senha atualizada, usuario Database Access, IP permitido e status do cluster.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
