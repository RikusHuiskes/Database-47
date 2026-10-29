import {managedAccess} from '../../../lib/managed-events';
import {visitorEventInput} from '../../../lib/visitor-event-input';
export const runtime='nodejs';
export async function GET(request:Request){
  const id=new URL(request.url).searchParams.get('id')??'',client=await managedAccess(request,id);
  if(!client)return Response.json({error:'Deze beheerlink is ongeldig. Gebruik je persoonlijke link.'},{status:401});
  const [{data:event,error},{data:links},{data:categories},{data:advertising}]=await Promise.all([
    client.from('events').select('id,title,short_description,description,venue_name,address,postcode,city,start_at,end_at,website_url,booking_url,source_url,contact_phone,image_url,is_free,price_from,price_to,is_directory_entry,status,promotion_type,promotion_status').eq('id',id).eq('is_manual_entry',true).maybeSingle(),
    client.from('event_categories').select('category_id').eq('event_id',id),
    client.from('categories').select('id,name').eq('active',true).order('name'),
    client.from('advertising_requests').select('id,placement,starts_on,ends_on,months,amount_cents,payment_status').eq('event_id',id).order('created_at',{ascending:false}).limit(1)
  ]);
  if(error||!event)return Response.json({error:'Vermelding niet gevonden.'},{status:404});
  return Response.json({event,categoryId:links?.[0]?.category_id??'',categories,advertising:advertising?.[0]??null},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
  try{
    const text=await request.text();if(text.length>24000)throw Error('De invoer is te groot.');
    const body=JSON.parse(text),client=await managedAccess(request,body.id);
    if(!client)return Response.json({error:'Ongeldige beheerlink.'},{status:401});
    const existing=await client.from('events').select('image_url,is_directory_entry').eq('id',body.id).eq('is_manual_entry',true).maybeSingle();
    if(existing.error||!existing.data)return Response.json({error:'Vermelding niet gevonden.'},{status:404});
    const input={...body.event,is_directory_entry:existing.data.is_directory_entry};
    // Retain existing/legacy photographs without forcing another upload.
    if(input.image_url===existing.data.image_url)delete input.image_url;
    const patch=visitorEventInput(input,true);
    const {error}=await client.rpc('update_managed_event',{p_id:body.id,p_patch:patch,p_category_id:body.categoryId||null});
    if(error)throw Error(error.message);
    return Response.json({ok:true});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Wijzigen mislukt.'},{status:400});}
}
