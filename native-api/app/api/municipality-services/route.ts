import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {GET as directory} from '../../../../app/api/municipality-services/route';
import {decorateMunicipalDirectory} from '../../../../lib/municipal-advertising-server';
import {distanceInKm} from '../../../../lib/local-area';
import {SHOP_TYPES} from '../../../../lib/municipal-shops';
import catalog from '../../../../lib/data/area-catalog.json';
export const maxDuration=60;
const types=new Set(['all',...SHOP_TYPES,'estate_agent','mairie','doctor','hospital','library','pharmacy','church','tourism','dentist','supermarket','fuel','charging','public_transport','parking','disabled_parking']);
export async function GET(request:NextRequest){
 const url=new URL(request.url),type=url.searchParams.get('service')||'all',code=url.searchParams.get('codeInsee');
 const town=catalog.areas.find(item=>(code?item.code_insee===code:item.name.toLowerCase()===(url.searchParams.get('city')||'Duras').toLowerCase())&&distanceInKm(44.6755,.2021,item.latitude,item.longitude)<=50);
 if(!town||!types.has(type))return NextResponse.json({error:'Kies een gemeente en categorie uit de gids van Duras.'},{status:400});
 for(const [key,value] of Object.entries({city:town.name,codeInsee:town.code_insee,lat:String(town.latitude),lon:String(town.longitude),service:type}))url.searchParams.set(key,value);
 const response=await directory(new NextRequest(url));if(!response.ok)return response;
 let body=await response.json();const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(base&&key)body=await decorateMunicipalDirectory(body,town.code_insee,type,createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}}));
 return NextResponse.json(body,{headers:{'Cache-Control':'public, max-age=60, s-maxage=300, stale-while-revalidate=300'}});
}
