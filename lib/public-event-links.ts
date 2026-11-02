/** Visitor links lead to an organiser, never to an imported dataset. */
export function publicEventUrl(value:string|null|undefined):string|null{
 if(!value)return null;
 try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))return null;
  if(/\.(?:csv|json|xml|xlsx?|zip)(?:$|\/)/i.test(url.pathname)||/sirtaqui-od-liste|liste-csv/i.test(url.href))return null;
  return url.href;
 }catch{return null;}
}
export function publicEventText(text:string):string{
 const result=text.replace(/\s*(?:Bron|Source)\s*:\s*SIRTAQUI\b[\s\S]*$/i,'');
 return result===text?text:result.trimEnd();
}
/** Keep provenance in administrator records, out of the public event response. */
export function visitorEventData<T>(value:T):T{
 function visit(item:unknown):unknown{
  if(Array.isArray(item))return item.map(visit);
  if(!item||typeof item!=='object')return item;
  const source=item as Record<string,unknown>,result:Record<string,unknown>={};
  for(const [key,entry]of Object.entries(source)){
   if(key==='source_url'&&typeof source.id==='string')continue;
   if((key==='website_url'||key==='booking_url')&&typeof entry==='string')result[key]=publicEventUrl(entry);
   else result[key]=typeof entry==='object'?visit(entry):entry;
  }return result;
 }return visit(value) as T;
}
