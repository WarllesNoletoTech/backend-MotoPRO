export type ParsedCommand =
 | {kind:'entry';type:'income'|'expense';category:'delivery'|'bonus'|'fuel'|'maintenance'|'food'|'other';amountCents:number;description:string}
 | {kind:'summary';period:'week'|'today'}
 | {kind:'unknown';message:string};

export const normalizeText = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const units:Record<string,number>={
 um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,
 dez:10,onze:11,doze:12,treze:13,quatorze:14,catorze:14,quinze:15,dezesseis:16,
 dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,
 sessenta:60,setenta:70,oitenta:80,noventa:90,cem:100,cento:100,duzentos:200,
 duzentas:200,trezentos:300,trezentas:300,quatrocentos:400,quinhentos:500,
 seiscentos:600,setecentos:700,oitocentos:800,novecentos:900,mil:1000
};
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
const validAmount=(n:number)=>Number.isSafeInteger(n)&&n>0&&n<=100_000_000?n:null;
function numericCents(value:string):number|null{
 const raw=value.replace(/\s/g,'');
 const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):
  /^\d{1,3}(?:\.\d{3})+$/.test(raw)?raw.replace(/\./g,''):raw;
 return validAmount(Math.round(Number(normalized)*100));
}
function wordAmount(s:string):number|null{
 const tokens=s.replace(/[!?;:.,]/g,' ').split(/\s+/).filter(Boolean);
 for(let i=0;i<tokens.length;i++){
  if(!/^(?:reais?|contos?)$/.test(tokens[i]))continue;
  // Examine a sequência mais próxima antes da moeda.
  for(let start=Math.max(0,i-8);start<i;start++){
   const n=wordsToNumber(tokens.slice(start,i).join(' '));
   if(n!==null&&n>0)return validAmount(n*100);
  }
 }
 // Sem moeda: 'abasteci trinta e cinco com gasolina'.
 for(let i=0;i<tokens.length;i++){
  if(units[tokens[i]]===undefined)continue;
  for(let end=Math.min(tokens.length,i+8);end>i;end--){
   const n=wordsToNumber(tokens.slice(i,end).join(' '));
   if(n!==null&&n>0)return validAmount(n*100);
  }
 }
 return null;
}
export function extractAmountCents(text:string):number|null{
 const s=normalizeText(text).replace(/\s+/g,' ').trim();
 // Prefira valores com R$ ou 'reais' a litros, km ou números de entregas.
 const currency=s.match(/r\$\s*(\d{1,6}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
 if(currency){const value=numericCents(currency[1]);if(value!==null)return value;}
 const monetary=s.match(/\b(\d+(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais?|contos?)\b/);
 if(monetary){const value=numericCents(monetary[1]);if(value!==null)return value;}
 const spoken=wordAmount(s);
 if(spoken!==null)return spoken;
 const fallback=s.match(/\b\d+(?:\.\d{3})*(?:,\d{1,2})?\b|\b\d+(?:[.,]\d{1,2})?\b/);
 return fallback?numericCents(fallback[0]):null;
}
export function parseCommand(text:string):ParsedCommand{
 const original=text.trim().replace(/\s+/g,' ');
 const s=normalizeText(original);
 if(!s)return {kind:'unknown',message:'Escreva ou fale um comando.'};

 const query=/^(?:quanto|quantos|qual|quais|resumo|meu saldo|saldo|meu lucro|lucro|total|balanco)\b/.test(s) ||
  /\b(me mostre|mostra|me diga|como foi)\b/.test(s) && /\b(ganho|ganhos|gastos|despesas|receitas|lucro)\b/.test(s) ||
  /\b(quanto|qual)\b/.test(s) && /\b(lucrei|ganhei|gastei|recebi)\b/.test(s);
 if(query)return {kind:'summary',period:/\b(hoje|dia de hoje)\b/.test(s)?'today':'week'};

 const fuel=/\b(abastec\w*|abastecimento|gasolina|etanol|alcool|combustivel|diesel|tanque)\b/.test(s);
 const maintenance=/\b(troquei|troca|revisao|pneu\w*|oleo|manutencao|oficina|conserto\w*)\b/.test(s);
 const food=/\b(almoc\w*|jant\w*|comida|lanche|refeicao|cafe)\b/.test(s);
 const incomeVerb=/\b(ganhei|recebi|faturei|entrou|ganho|recebimento|gorjeta\w*|bonus|bonificacao)\b/.test(s) ||
  /\bfiz\s+(?:\d+[\s\w]*|[a-z\s]+)\s+(?:de|em)\s+entregas?\b/.test(s);
 const expenseVerb=/\b(gastei|gasto|paguei|pagamento|despesa|comprei|custo|custou|abastec\w*|abastecimento|coloquei|troquei|revisao|manutencao)\b/.test(s);
 const income=incomeVerb;
 const expense=expenseVerb||((fuel||maintenance||food)&&!incomeVerb);
 if(income&&expense)return {kind:'unknown',message:'Encontrei receita e despesa na mesma frase. Diga uma operação por vez.'};
 if(!income&&!expense)return {kind:'unknown',message:'Tente dizer: “Ganhei 120 reais em entregas” ou “Abasteci 35 reais”.'};
 const amountCents=extractAmountCents(original);
 if(!amountCents)return {kind:'unknown',message:'Não identifiquei o valor. Diga, por exemplo: “Gastei 35 reais”.'};
 const type=income?'income':'expense';
 const category=type==='income'?(/\b(bonus|bonificacao|gorjeta)\b/.test(s)?'bonus':'delivery'):
  fuel?'fuel':maintenance?'maintenance':food?'food':'other';
 return {kind:'entry',type,category,amountCents,description:original.slice(0,160)};
}
