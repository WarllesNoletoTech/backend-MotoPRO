// Agende no Heroku Scheduler a cada dia: npm run push:daily
import 'dotenv/config';
import mongoose from 'mongoose';
import {runDailyPush} from '../dist/services/dailyPush.js';
const uri=process.env.MONGODB_URI;
if(!uri||!/^mongodb(\+srv)?:\/\//.test(uri))throw new Error('MONGODB_URI inválida');
try{
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 const batch=Number(process.env.PUSH_BATCH_SIZE||150);
 const stats=await runDailyPush(Number.isFinite(batch)?batch:150);
 console.log('Push diário MotoPRO:',JSON.stringify(stats));
 if(stats.failed)process.exitCode=1;
}finally{await mongoose.disconnect();}
