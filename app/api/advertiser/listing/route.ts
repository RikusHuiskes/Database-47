import {createServiceClient} from '../../../../lib/supabase-server';
import {POST as municipalListing} from '../../municipal-listing/route';
export const runtime='nodejs';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 try{const raw=await request.text();if(raw.length>1500)throw Error('Ongeldige vermelding.');const body=JSON.parse(raw);let id=body.eventId;
 if(!id&&body.serviceId){const resolved=await municipalListing(new Request(new URL('/api/municipal-listing',request.url),{method:'POST',headers:{origin:new URL(request.url).origin,'Content-Type':'application/json'},body:JSON.stringify({serviceId:body.serviceId,city:body.city})}));const data=await resolved.json();if(!resolved.ok)throw Error(data.error);id=data.eventId;}
 if(typeof id!=='string'||! /^[a-f0-9-]{36}$/i.test(id))throw Error('Kies een bestaande vermelding.');const db=createServiceClient();if(!db)throw Error('De database is tijdelijk niet beschikbaar.');
 const {data,error}=await db.from('events').select('id,title,city,image_url,short_description,municipal_key,is_directory_entry,start_at,end_at').eq('id',id).eq('status','approved').eq('verified',true).is('archived_at',null).maybeSingle();
 if(error||!data||!data.is_directory_entry&&new Date(data.end_at||data.start_at)<new Date())throw Error('Deze vermelding is niet beschikbaar voor adverteren.');return Response.json({listing:data},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Vermelding niet beschikbaar.'},{status:400});}
}
