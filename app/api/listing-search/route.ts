import {createClient} from '@supabase/supabase-js';
import areas from '../../../lib/data/area-catalog.json';
import {municipalCatalog} from '../../../lib/municipal-catalog';
import {COMMERCIAL_SERVICE_TYPES} from '../../../lib/municipal-shops';
import {normalizePlaceName} from '../../../lib/local-area';
import {decorateMunicipalDirectory} from '../../../lib/municipal-advertising-server';

export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const q=(params.get('q')??'').trim(),city=(params.get('city')??'').trim(),source=params.get('source')??'events';
 const page=Number(params.get('page')??0),size=20;
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(q.length<2||q.length>120||city.length>150||!['events','directory'].includes(source)||!Number.isInteger(page)||page<0||page>500)return reply({error:'Vul minstens twee letters van de naam in en kies een geldige plaats.'},400);
 if(source==='directory'){
  const area=areas.areas.find(item=>normalizePlaceName(item.name)===normalizePlaceName(city));
  if(!area)return reply({error:'Kies voor de gemeentegids een plaats uit de lijst.'},400);
  const directory=await decorateMunicipalDirectory(municipalCatalog(area.name,area.latitude,area.longitude,'all',area.code_insee,false),area.code_insee,'all');
  const results=directory.services
   .filter(item=>COMMERCIAL_SERVICE_TYPES.includes(item.type)&&normalizePlaceName(item.name).includes(normalizePlaceName(q)))
   .flatMap(item=>{
    const actual=areas.areas.find(candidate=>item.codeInsee?candidate.code_insee===item.codeInsee:normalizePlaceName(candidate.name)===normalizePlaceName(item.municipality??''));
    return actual?[{id:'',serviceId:item.id,title:item.name,city:actual.name,address:item.address??''}]:[];
   });
  return reply({results:results.slice(page*size,(page+1)*size),hasMore:results.length>(page+1)*size});
 }
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return reply({error:'Zoeken is tijdelijk niet beschikbaar.'},503);
 // Public discovery uses the anonymous role and an explicit public field list.
 // Selecting a result never grants access to drafts, billing or owner tokens.
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const literal=(value:string)=>value.replace(/[\\%_]/g,'\\$&');
 let query=client.from('events').select('id,title,city,address,start_at,is_directory_entry')
  .eq('status','approved').eq('verified',true).is('municipal_key',null)
  .ilike('title','%'+literal(q)+'%').order('title').order('id');
 if(city)query=query.ilike('city',literal(city));
 const {data,error}=await query.range(page*size,(page+1)*size);
 if(error)return reply({error:'Vermeldingen konden niet worden geladen. Probeer het opnieuw.'},502);
 return reply({results:(data??[]).slice(0,size),hasMore:(data??[]).length>size});
}
