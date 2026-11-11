export function isValidDateOnly(s:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d=new Date(`${s}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().startsWith(s);
}
export function dateInTimezone(timezone='America/Belem',at:Date=new Date()):string {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function addDays(iso:string,days:number):string {
  const d=new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}
export function weekRangeTuesday(today:string):{from:string;to:string} {
  if(!isValidDateOnly(today)) throw new Error('Data inválida');
  const day=new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const from=addDays(today,-((day+5)%7));
  return {from,to:addDays(from,6)};
}
