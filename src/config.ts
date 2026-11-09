import 'dotenv/config';
export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/motopro',
  jwtSecret: process.env.JWT_SECRET || '',
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:3000',
  isProd: process.env.NODE_ENV === 'production',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe'
};
export function validateConfig() {
  if(config.jwtSecret.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres. Execute CONFIGURAR_WINDOWS.bat.');
  if(!/^mongodb(\+srv)?:\/\//.test(config.mongoUri) || /HOST_REAL_DO_ATLAS|SEU-CLUSTER|SENHA_ATUALIZADA|CLUSTER\.mongodb/i.test(config.mongoUri)) {
    throw new Error('MONGODB_URI nao configurada corretamente. Execute CONFIGURAR_WINDOWS.bat.');
  }
  if(!Number.isFinite(config.port)) throw new Error('PORT inválida');
  if(config.isProd && !config.appOrigin.startsWith('https://')) throw new Error('APP_ORIGIN deve ser HTTPS em produção');
}
