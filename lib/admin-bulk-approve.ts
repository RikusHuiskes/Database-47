import type {SupabaseClient} from '@supabase/supabase-js';

type ImportCandidate={id:string;status?:string;source_url?:string|null;is_manual_entry?:boolean|null};
const hosts=new Set(['www.tourismeduras.com','tourismeduras.com','www.eymet-dordogne.fr','eymet-dordogne.fr','www.pays-bergerac-tourisme.com','pays-bergerac-tourisme.com','aquitaine.media.tourinsoft.eu','openagenda.com','www.openstreetmap.org','www.mairie-marmande.fr','mairie-marmande.fr','www.ville-miramontdeguyenne.fr','ville-miramontdeguyenne.fr','commune-de-miramont-de-guyenne.neopse-site.com','www.pineuilh.fr','pineuilh.fr','www.saintefoylagrande.fr','saintefoylagrande.fr']);

export function isPendingImport(event:ImportCandidate){
  if(event.status!=='pending'||event.is_manual_entry!==false||!event.source_url)return false;
  try{const url=new URL(event.source_url);return url.protocol==='https:'&&!url.username&&!url.password&&hosts.has(url.hostname);}catch{return false;}
}

export async function approvePendingImports(client:Pick<SupabaseClient,'from'>,events:ImportCandidate[],onProgress:(progress:{processed:number;approved:number;total:number})=>void){
  const ids=[...new Set(events.filter(isPendingImport).map(event=>event.id))];
  let approved=0;
  for(let offset=0;offset<ids.length;offset+=100){
    const batch=ids.slice(offset,offset+100);
    const {data,error}=await client.from('events').update({status:'approved',verified:true}).in('id',batch).eq('status','pending').eq('is_manual_entry',false).select('id');
    if(error)throw new Error(error.message);
    approved+=data?.length??0;
    onProgress({processed:Math.min(offset+100,ids.length),approved,total:ids.length});
  }
  return {approved,skipped:ids.length-approved};
}
