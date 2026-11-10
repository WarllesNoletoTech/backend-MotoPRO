export type ParsedCommand =
 | {kind:'entry';type:'income'|'expense';category:'delivery'|'bonus'|'fuel'|'maintenance'|'food'|'other';amountCents:number;description:string}
 | {kind:'summary';period:'week'|'today'}
 | {kind:'unknown';message:string};

export const normalizeText = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

// Valores de dinheiro em português brasileiro. A IA entende a intenção, mas o
// valor só é aceito quando também puder ser confirmado nas palavras do usuário.
const units:Record<string,number>={
 um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,
 dez:10,onze:11,doze:12,treze:13,quatorze:14,catorze:14,quinze:15,dezesseis:16,
 dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,
 sessenta:60,setenta:70,oitenta:80,noventa:90,cem:100,cento:100,duzentos:200,
 duzentas:200,trezentos:300,trezentas:300,quatrocentos:400,quinhentos:500,
 seiscentos:600,setecentos:700,oitocentos:800,novecentos:900
};
const MAX_AMOUNT_CENTS=100_000_000;
const moneyLabels=new Set(['real','reais','conto','contos']);
const physicalLabels=new Set(['litro','litros','km','quilometro','quilometros','entrega','entregas','corrida','corridas','hora','horas','minuto','minutos','dia','dias']);
const moneyVerbs=new Set(['ganhei','recebi','faturei','rendeu','entrou','paguei','gastei','custou','deu','coloquei','abasteci','gasto','fiz','cobrei','vendi','tive','recebimento','ganho']);

type NumberMatch={value:number;end:number};
function tokenize(text:string):string[]{
 return normalizeText(text).replace(/r\s*\$/g,' r$ ').match(/r\$|\d+(?:[.,]\d+)*|[a-z]+/g)||[];
}
function numericBR(raw:string):number|null{
 // 1.000 ou 25.000,50: pontuação de milhar brasileira.
 let normalized:string;
 if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw))normalized=raw.replace(/\./g,'').replace(',','.');
 else if(/^\d+(?:,\d{1,2})?$/.test(raw))normalized=raw.replace(',','.');
 else if(/^\d+\.\d{1,2}$/.test(raw))normalized=raw;
 else return null;
 const value=Number(normalized);
 return Number.isFinite(value)&&value>=0?value:null;
}
function amountToCents(value:number):number|null{
 const cents=Math.round(value*100);
 return Number.isSafeInteger(cents)&&cents>0&&cents<=MAX_AMOUNT_CENTS?cents:null;
}
function readNumber(tokens:string[],start:number):NumberMatch|null{
 let total=0,part=0,index=start,seen=false,previousWasAnd=false;
 for(;index<tokens.length;index++){
  const token=tokens[index];
  if(token==='e'){
   if(!seen||previousWasAnd||index+1>=tokens.length||
      !(tokens[index+1] in units)&&tokens[index+1]!=='mil'&&tokens[index+1]!=='k'&&tokens[index+1]!=='milhao'&&tokens[index+1]!=='milhoes'&&numericBR(tokens[index+1])===null)break;
   previousWasAnd=true;
   continue;
  }
  if(token==='mil'||token==='k'){
   total+=(part||1)*1000;
   part=0;seen=true;previousWasAnd=false;
   continue;
  }
  if(token==='milhao'||token==='milhoes'){
   total+=(part||1)*1_000_000;part=0;seen=true;previousWasAnd=false;
   continue;
  }
  const amount=token in units?units[token]:numericBR(token);
  if(amount===null||amount===undefined)break;
  // Evita valores semanticamente impossíveis: 25,50 20 não é um número falado.
  if(amount%1!==0&&index+1<tokens.length&&tokens[index+1]!=='mil'){
   part+=amount;seen=true;index++;break;
  }
  part+=amount;seen=true;previousWasAnd=false;
 }
 if(!seen)return null;
 if(previousWasAnd)index--; // 'e' não completa uma quantia.
 return {value:total+part,end:index};
}
function readBefore(tokens:string[],end:number):NumberMatch|null{
 // Procura a maior expressão numérica imediatamente antes de 'reais'.
 for(let start=Math.max(0,end-12);start<end;start++){
  const found=readNumber(tokens,start);
  if(found&&found.end===end)return found;
 }
 return null;
}
function centsAfterReal(tokens:string[],currencyIndex:number):number{
 // "mil reais e cinquenta centavos" = R$ 1.000,50.
 let start=currencyIndex+1;
 if(tokens[start]==='e')start++;
 const found=readNumber(tokens,start);
 return found&&tokens[found.end]==='centavos'&&Number.isInteger(found.value)&&found.value>=0&&found.value<100
  ?found.value:0;
}
function moneyCandidate(tokens:string[],found:NumberMatch,currencyIndex?:number):number|null{
 const cents=amountToCents(found.value);
 if(cents===null)return null;
 const extra=currencyIndex===undefined?0:centsAfterReal(tokens,currencyIndex);
 return cents+extra<=MAX_AMOUNT_CENTS?cents+extra:null;
}
function isPhysicalQuantity(tokens:string[],end:number):boolean{
 return physicalLabels.has(tokens[end]||'');
}
export function extractAmountCents(text:string):number|null{
 const tokens=tokenize(text);
 // Centavos por extenso sem a palavra 'reais': '50 centavos' e
 // '25 mil e 50 centavos'. O 'e' em 'trinta e cinco centavos' continua
 // pertencendo ao número 35, e não separa reais de centavos.
 for(let i=0;i<tokens.length;i++){
  if(tokens[i]!=='centavo'&&tokens[i]!=='centavos')continue;
  if(tokens.slice(Math.max(0,i-5),i).some(t=>moneyLabels.has(t)))continue;
  for(let e=i-2;e>=Math.max(0,i-10);e--){
   if(tokens[e]!=='e')continue;
   const fractional=readNumber(tokens,e+1);
   if(!fractional||fractional.end!==i||!Number.isInteger(fractional.value)||fractional.value<0||fractional.value>=100)continue;
   const whole=readBefore(tokens.slice(0,e),e);
   if(whole&&whole.value>=1000){
    const cents=amountToCents(whole.value);
    if(cents!==null&&cents+fractional.value<=MAX_AMOUNT_CENTS)return cents+fractional.value;
   }
  }
  const centsPart=readBefore(tokens,i);
  if(centsPart&&Number.isInteger(centsPart.value)&&centsPart.value>0&&centsPart.value<=MAX_AMOUNT_CENTS)return centsPart.value;
 }
 // 1. Valor com R$ tem prioridade sobre litros, quilômetros e contagem de entregas.
 for(let i=0;i<tokens.length;i++){
  if(tokens[i]!=='r$')continue;
  const found=readNumber(tokens,i+1);
  if(found){const cents=moneyCandidate(tokens,found,moneyLabels.has(tokens[found.end]||'')?found.end:undefined);
   if(cents!==null)return cents;}
 }
 // 2. 25 mil reais, mil reais, 1.250,50 reais, vinte e cinco reais.
 for(let i=0;i<tokens.length;i++){
  if(!moneyLabels.has(tokens[i]))continue;
  const found=readBefore(tokens,i);
  if(found){const cents=moneyCandidate(tokens,found,i);if(cents!==null)return cents;}
 }
 // 3. Comandos informais sem 'reais': 'recebi 25 mil', 'abasteci mil'.
 // Não transforma 'ganhei 5 entregas' ou 'abasteci 8 litros' em valores monetários.
 for(let i=0;i<tokens.length;i++){
  if(!moneyVerbs.has(tokens[i]))continue;
  let start=i+1;
  while(['uns','umas','um','uma','cerca','de','aproximadamente','mais','ou','menos'].includes(tokens[start])&&start<i+5)start++;
  // 'um mil' não deve perder o multiplicador 'um'.
  if(tokens[i+1]==='um'||tokens[i+1]==='uma')start=i+1;
  const found=readNumber(tokens,start);
  if(!found||isPhysicalQuantity(tokens,found.end))continue;
  const cents=moneyCandidate(tokens,found,moneyLabels.has(tokens[found.end]||'')?found.end:undefined);
  if(cents!==null)return cents;
 }
 // 4. '25 mil' isolado pode ser conferido, mas quantidades físicas isoladas não.
 // Com mais de uma quantidade sem verbo monetário, exigimos esclarecimento.
 let foundCount=0,candidate:number|null=null;
 for(let i=0;i<tokens.length;i++){
  if(!(tokens[i] in units)&&!['mil','k','milhao','milhoes'].includes(tokens[i])&&numericBR(tokens[i])===null)continue;
  const found=readNumber(tokens,i);
  if(!found||isPhysicalQuantity(tokens,found.end)){i=found?Math.max(i,found.end-1):i;continue;}
  if(tokens.some(t=>physicalLabels.has(t)))return null;
  const cents=moneyCandidate(tokens,found);
  if(cents!==null){candidate=cents;foundCount++;}
  i=Math.max(i,found.end-1);
 }
 return foundCount===1?candidate:null;
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
