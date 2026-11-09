import {nameParts,validNamePart,joinFullName} from '../utils/name.js';

/** Detalhes de um item na API Orders; total e preço unitário são a mesma cobrança. */
export function makePixOrderPayload(paymentId:string,amountCents:number,email:string,fullName:string,storedFirstName?:string|null,storedLastName?:string|null){
 const parsed=nameParts(fullName);
 if(!parsed.complete)throw new Error('Nome completo é obrigatório para o Pix');
 const separateFieldsValid=validNamePart(storedFirstName||'')&&validNamePart(storedLastName||'')&&joinFullName(storedFirstName!,storedLastName!).length<=90;
 const firstName=separateFieldsValid?storedFirstName!:parsed.firstName;
 const lastName=separateFieldsValid?storedLastName!:parsed.lastName;
 if(!Number.isInteger(amountCents)||amountCents<=0)throw new Error('Valor do Pix inválido');
 const amount=(amountCents/100).toFixed(2);
 return {
  type:'online',
  processing_mode:'automatic',
  total_amount:amount,
  external_reference:`motopro_pix_${paymentId}`,
  description:'MotoPRO Premium - assinatura de 7 dias',
  items:[{title:'MotoPRO Premium - 7 dias',quantity:1,unit_price:amount,description:'Acesso semanal ao MotoPRO',category_id:'services'}],
  transactions:{payments:[{amount,payment_method:{id:'pix',type:'bank_transfer'},expiration_time:'PT30M'}]},
  payer:{email,first_name:firstName,last_name:lastName}
 };
}
