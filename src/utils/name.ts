/** Um nome completo contém nome e pelo menos um sobrenome; não aceita iniciais. */
export function normalizeNamePart(value:string):string {
 return value.normalize('NFC').trim().replace(/\s+/g,' ');
}
const word=/^[\p{L}][\p{L}\p{M}'’-]*$/u;
export function validNamePart(value:string):boolean {
 const part=normalizeNamePart(value);
 return part.length>=2 && part.length<=90 && part.split(' ').every(w=>w.length>=2 && word.test(w));
}
export function joinFullName(firstName:string,lastName:string):string {
 return `${normalizeNamePart(firstName)} ${normalizeNamePart(lastName)}`.trim();
}
export function nameParts(fullName:string):{firstName:string;lastName:string;complete:boolean} {
 const parts=normalizeNamePart(fullName||'').split(' ');
 const firstName=parts[0]||'';
 const lastName=parts.slice(1).join(' ');
 return {firstName,lastName,complete:validNamePart(firstName)&&validNamePart(lastName)&&joinFullName(firstName,lastName).length<=90};
}
