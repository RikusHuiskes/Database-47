import {NextResponse} from "next/server";
import {createServiceClient} from "../../../lib/supabase-server";
import areas from "../../../lib/data/area-catalog.json";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions=new Set(['visit','page_view','filter_view','category_view','place_view','event_view','impression','outbound']);
export async function POST(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Ongeldige oorsprong.'},{status:403});
  if(/bot|crawler|spider|headless|preview/i.test(request.headers.get('user-agent')??''))return new Response(null,{status:204});
  if(Number(request.headers.get('content-length'))>2048)return new Response(null,{status:413});
  let data;
  try{const text=await request.text();if(text.length>2048)return new Response(null,{status:413});data=JSON.parse(text);}catch{return new Response(null,{status:400});}
  if(!data || !['id','visitorId','sessionId'].every(key=>typeof data[key]==='string'&&uuid.test(data[key])) || !actions.has(data.action)
    || !['eventId','categoryId'].every(key=>data[key]==null||typeof data[key]==='string'&&uuid.test(data[key]))
    || !Number.isFinite(Date.parse(data.consentAt)) || Date.parse(data.consentAt)>Date.now()+60000 || Date.parse(data.consentAt)<Date.now()-180*86400000
    || !['standard','homepage','category','highlight'].includes(data.placement??'standard')
    || data.channel!=null&&!['website','booking','source'].includes(data.channel)
    || data.page!=null&&!['/','/statistieken'].includes(data.page)
    || data.radius!=null&&!['10','25','50'].includes(data.radius)
    || data.action==='page_view'&&data.page==null
    || data.action==='filter_view'&&data.radius==null
    || data.area!=null&&!areas.areas.some(a=>a.name===data.area))return new Response(null,{status:400});
  const client=createServiceClient();if(!client)return new Response(null,{status:503});
  const {error}=await client.rpc('record_site_analytics',{p_data:{id:data.id,visitorId:data.visitorId,sessionId:data.sessionId,consentAt:data.consentAt,action:data.action,eventId:data.eventId??null,categoryId:data.categoryId??null,area:data.area??null,placement:data.placement??'standard',channel:data.channel??null,page:data.page??null,radius:data.radius??null}});
  return new Response(null,{status:error?503:204});
}
