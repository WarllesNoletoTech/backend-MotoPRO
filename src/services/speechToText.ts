// Transcrição do áudio em português brasileiro. Os exemplos de valores não são incluídos no contexto
// para evitar favorecer palavras/números que o motoboy não falou.
import {HttpError} from '../utils/http.js';

const context = 'Gravação curta em português brasileiro, de um entregador que registra ganhos, gastos, abastecimentos e pergunta sobre suas finanças. Transcreva fielmente o que ouvir. Não invente frases, valores, nomes ou números.';
const keywords = ['MotoPRO', 'Rappidex', 'motoboy', 'entregas', 'corridas', 'frete', 'gorjeta', 'abasteci', 'abastecimento', 'combustível', 'etanol', 'gasolina', 'quilometragem', 'reais', 'centavos'];

export function speechModel(primary:string, alternative=false) {
  // A segunda leitura utiliza outro modelo somente mediante pedido do usuário.
  if (!alternative) return primary;
  return primary === 'gpt-4o-transcribe' ? 'gpt-transcribe' : 'gpt-4o-transcribe';
}

export function makeSpeechForm(audio:Buffer, mime:string, model:string) {
  const normalizedMime=mime.split(';')[0];
  const ext=normalizedMime.includes('webm')?'webm':normalizedMime.includes('ogg')?'ogg':normalizedMime.includes('wav')?'wav':normalizedMime.includes('mpeg')?'mp3':'mp4';
  const form=new FormData();
  form.append('file',new Blob([new Uint8Array(audio)],{type:normalizedMime}),`comando.${ext}`);
  form.append('model',model);
  form.append('response_format','json');
  form.append('prompt',context);
  if(model==='gpt-transcribe') {
    // Na nova API, languages[] substitui language=pt; keywords[] são dicas, não texto obrigatório.
    form.append('languages[]','pt');
    for(const keyword of keywords) form.append('keywords[]',keyword);
  } else {
    form.append('language','pt');
  }
  return form;
}

export async function recognizeAudio(audio:Buffer,mime:string,apiKey:string,model:string) {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),25_000);
  try {
    const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{
      method:'POST',
      headers:{Authorization:`Bearer ${apiKey}`},
      body:makeSpeechForm(audio,mime,model),
      signal:controller.signal,
    });
    if(!response.ok){
      console.warn('Falha de transcrição OpenAI:',response.status);
      if(response.status===401||response.status===403)throw new HttpError(502,'A chave OpenAI não tem acesso ao modelo de transcrição selecionado.');
      if(response.status===429)throw new HttpError(503,'A transcrição está temporariamente indisponível. Tente novamente.');
      throw new HttpError(502,'Não foi possível transcrever o áudio. Tente outra gravação.');
    }
    const parsed=await response.json() as {text?:unknown};
    if(typeof parsed.text!=='string'||!parsed.text.trim())throw new HttpError(422,'Não foi possível ouvir a frase. Grave novamente mais perto do microfone.');
    return parsed.text.trim().slice(0,500);
  } catch(error){
    if(error instanceof HttpError)throw error;
    if((error as {name?:string})?.name==='AbortError')throw new HttpError(504,'A transcrição demorou muito. Tente novamente.');
    console.warn('Erro de conexão ao transcrever o áudio');
    throw new HttpError(502,'Erro de conexão com a transcrição. Tente novamente.');
  } finally {
    clearTimeout(timeout);
  }
}
