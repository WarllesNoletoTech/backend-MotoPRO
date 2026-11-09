export type ParsedCommand =
 | {kind:'entry';type:'income'|'expense';category:'delivery'|'bonus'|'fuel'|'maintenance'|'food'|'other';amountCents:number;description:string}
 | {kind:'summary';period:'week'|'today'}
 | {kind:'unknown';message:string};
export const normalizeText=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const units:Record<string,number>={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90,cem:100,cento:100,duzentos:200,trezentos:300,quatrocentos:400,quinhentos:500,mil:1000};
function wordsToNumber(s:string):number|null{
 let total=0,part=0,count=0;
 for(const w of s.trim().split(/\s+/)){
  if(w==='e')continue;
  const n=units[w];if(n===undefined)return null;
  count++;
  if(w==='mil'){total+=(part||1)*1000;part=0;}else part+=n;
 }
 return count?total+part:null;
}
export function extractAmountCents(text:string):number|null{
 const s=normalizeText(text);
 const m=s.match(/(?:r\$\s*)?(\d{1,6}(?:\.\d{3})*(?:,\d{1,2})?|\d{1,6}(?:[.,]\d{1,2})?)/);
 if(m){
  const v=m[1].replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');
  const n=Math.round(Number(v)*100);
  return Number.isSafeInteger(n)&&n>0&&n<=100_000_000?n:null;
 }
 const wm=s.match(/\b([a-z ]+?)\s+reais?\b/);
 if(wm){
  const words=wm[1].split(/\s+/);
  for(let start=0;start<words.length;start++){
   const v=wordsToNumber(words.slice(start).join(' '));
   if(v!==null&&v>0&&v<=1_000_000)return v*100;
  }
 }
 return null;
}
export function parseCommand(text:string):ParsedCommand{
 const s=normalizeText(text.trim());
 if(!s)return {kind:'unknown',message:'Escreva ou fale um comando.'};
 if(/(quanto|qual|resumo|total|balanco|lucro|lucrei|ganhei)/.test(s)&&/(quanto|qual|resumo|total|balanco|lucro|lucrei)/.test(s)){
  return {kind:'summary',period:/(hoje|dia de hoje)/.test(s)?'today':'week'};
 }
 const income=/(ganhei|recebi|faturei|entrou|entrada|corrida|entrega)/.test(s);
 const expense=/(gastei|paguei|abasteci|despesa|comprei|troquei|coloquei gasolina)/.test(s);
 if(!income&&!expense)return {kind:'unknown',message:'Experimente: "Recebi 120 reais em entregas" ou "Abasteci 35 reais".'};
 if(income&&expense)return {kind:'unknown',message:'Informe apenas uma receita ou despesa por comando.'};
 const amountCents=extractAmountCents(s);
 if(!amountCents)return {kind:'unknown',message:'Não identifiquei o valor. Diga, por exemplo, "Gastei 35 reais".'};
 const type=income?'income':'expense';
 const category=type==='income'?(/bonus|gorjeta/.test(s)?'bonus':'delivery'):
  (/gasolina|combustivel|abastec|etanol/.test(s)?'fuel':/oleo|revisao|pneu|manutencao|oficina/.test(s)?'maintenance':/almoco|janta|comida|lanche/.test(s)?'food':'other');
 return {kind:'entry',type,category,amountCents,description:text.trim().slice(0,160)};
}
