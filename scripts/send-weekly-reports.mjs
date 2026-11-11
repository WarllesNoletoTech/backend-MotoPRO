// Execute no Heroku Scheduler: node scripts/send-weekly-reports.mjs
// Requer deploy com npm run build; não expõe endpoint HTTP.
import 'dotenv/config';
import mongoose from 'mongoose';
import {runWeeklyReports} from '../dist/services/runWeeklyReports.js';
const uri=process.env.MONGODB_URI;
if(!uri||!/^mongodb(\+srv)?:\/\//.test(uri))throw new Error('MONGODB_URI inválida');
try{
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 const limit=Number(process.env.REPORTS_BATCH_SIZE||80);
 const result=await runWeeklyReports(Number.isFinite(limit)?limit:80);
 console.log('Envio semanal MotoPRO:',JSON.stringify(result));
 if(result.failed)process.exitCode=1;
}finally{await mongoose.disconnect();}
