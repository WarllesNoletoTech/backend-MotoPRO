import 'dotenv/config';
export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/motopro',
  jwtSecret: process.env.JWT_SECRET || '',
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:3000',
  isProd: process.env.NODE_ENV === 'production',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-transcribe',
  commandModel: process.env.OPENAI_COMMAND_MODEL || 'gpt-4o-mini'
};
export function validateConfig() {
  if(config.jwtSecret.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres. Configure uma chave aleatória no Heroku (ou no .env local).');
  if(!/^mongodb(\+srv)?:\/\//.test(config.mongoUri) || /HOST_REAL_DO_ATLAS|SEU-CLUSTER|SENHA_ATUALIZADA|CLUSTER\.mongodb/i.test(config.mongoUri)) {
    throw new Error('MONGODB_URI inválida. Configure o valor real nas variáveis do Heroku (ou no .env local).');
  }
  if(!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('PORT inválida');
  if(config.isProd && !config.appOrigin.startsWith('https://')) throw new Error('APP_ORIGIN deve ser HTTPS em produção');
}
