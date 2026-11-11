export type ReconcileRow={id:string;amountCents:number;occurredOn:string;source:string;provider:string};
export function reconcileEntries(rows:ReconcileRow[]){
 const imported=rows.filter(r=>r.source==='integration'&&r.provider==='rappidex');
 const manual=rows.filter(r=>r.source!=='integration');
 const total=(arr:ReconcileRow[])=>arr.reduce((s,r)=>s+r.amountCents,0);
 const byDate=new Map<string,{date:string;importedCents:number;manualCents:number;importedCount:number;manualCount:number}>();
 for(const r of [...imported,...manual]){
  const d=byDate.get(r.occurredOn)||{date:r.occurredOn,importedCents:0,manualCents:0,importedCount:0,manualCount:0};
  if(r.source==='integration'){d.importedCents+=r.amountCents;d.importedCount++;}
  else{d.manualCents+=r.amountCents;d.manualCount++;}
  byDate.set(r.occurredOn,d);
 }
 const index=new Map<string,ReconcileRow[]>();
 for(const r of imported){const key=`${r.occurredOn}|${r.amountCents}`;index.set(key,[...(index.get(key)||[]),r]);}
 const possibleDuplicates:{occurredOn:string;amountCents:number;manualId:string;integrationId:string}[]=[];
 for(const r of manual){const key=`${r.occurredOn}|${r.amountCents}`,candidates=index.get(key);
  if(candidates?.length){const match=candidates.pop()!;possibleDuplicates.push({occurredOn:r.occurredOn,amountCents:r.amountCents,manualId:r.id,integrationId:match.id});}
 }
 return {importedCents:total(imported),manualCents:total(manual),importedCount:imported.length,manualCount:manual.length,possibleDuplicateCount:possibleDuplicates.length,
  possibleDuplicates:possibleDuplicates.sort((a,b)=>b.occurredOn.localeCompare(a.occurredOn)).slice(0,100),
  days:[...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date))};
}
