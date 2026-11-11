import {AiUsage} from '../models/AiUsage.js';
type Feature='transcription'|'interpretation'|'receipt';
type Outcome='success'|'failed'|'fallback';
export async function logAiUsage(userId:string,feature:Feature,outcome:Outcome,model='',usage?:{inputTokens?:number;outputTokens?:number}){
 const inputTokens=Math.max(0,usage?.inputTokens||0),outputTokens=Math.max(0,usage?.outputTokens||0);
 // Custos variam por contrato/modelo; só exibir estimativa se taxas forem definidas pelo administrador.
 const inputRate=Number(process.env.OPENAI_INPUT_USD_PER_1M||'');
 const outputRate=Number(process.env.OPENAI_OUTPUT_USD_PER_1M||'');
 const priced=inputTokens+outputTokens>0 && inputRate>0 && outputRate>0;
 try{await AiUsage.create({userId,feature,outcome,model,inputTokens,outputTokens,
   estimatedUsd:priced?(inputTokens*inputRate+outputTokens*outputRate)/1_000_000:null});}
 catch{console.warn('Não foi possível registrar métrica agregada de IA');}
}
