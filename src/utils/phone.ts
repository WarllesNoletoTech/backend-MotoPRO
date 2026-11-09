/** Telefone celular brasileiro com DDD armazenado no padrão E.164 (+55). */
export function normalizeBrazilMobilePhone(input:string):string|null {
 const value=input.trim();
 if(!value || !/^\+?[()\d.\s-]+$/.test(value))return null;
 let digits=value.replace(/\D/g,'');
 if(digits.length===13&&digits.startsWith('55'))digits=digits.slice(2);
 if(!/^[1-9][1-9]9\d{8}$/.test(digits))return null;
 return `+55${digits}`;
}
