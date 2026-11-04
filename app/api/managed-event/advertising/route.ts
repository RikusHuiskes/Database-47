import {managedAccess,tokenHash} from '../../../../lib/managed-events';
import {validateAdvertiser,advertisingSelectionQuote} from '../../../../lib/advertising';
export const runtime='nodejs';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 try{
  const text=await request.text();if(text.length>8000)throw Error('De invoer is te groot.');
  const body=JSON.parse(text),client=await managedAccess(request,body.eventId);
  if(!client)return Response.json({error:'Gebruik je persoonlijke beheerlink.'},{status:401});
  const selection=body.placements!==undefined;
  const {details,quote:singleQuote}=validateAdvertiser(selection&&Array.isArray(body.placements)?body.placements[0]:body.placement,body.advertiser);
  const quote=selection?advertisingSelectionQuote(body.placements,details):singleQuote;
  const token=request.headers.get('authorization')!.slice(7);
  const {data:id,error}=await client.rpc(selection?'request_managed_advertising_selection':'upgrade_managed_advertising',{p_event_id:body.eventId,p_token_hash:tokenHash(token),...(!selection?{p_placement:body.placement}:{}),p_ad:{...quote,details:selection?{...details,placements:('placements' in quote?quote.placements:[])}:details}});
  if(error)throw Error(error.message);
  if(process.env.MOLLIE_API_KEY?.startsWith('test_')){
   const marked=await client.from('advertising_requests').update({is_test_mode:true}).eq('id',id);
   if(marked.error)throw Error('De aanvraag is aangemaakt, maar de testmarkering kon niet worden opgeslagen. Neem contact op met de beheerder voordat je betaalt.');
  }
  const result=await client.from('advertising_requests').select('id,placement,starts_on,ends_on,months,amount_cents,payment_status,details').eq('id',id).single();
  if(result.error)throw Error('De aanvraag is opgeslagen. Vernieuw de pagina om de betaling te openen.');
  return Response.json({advertising:result.data},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Advertentie aanvragen mislukt.'},{status:400});}
}
