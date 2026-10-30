import {adminService} from '../../../../lib/admin-service';
import {managedToken,tokenHash} from '../../../../lib/managed-events';
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
  const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
  const {eventId}=await request.json();
  const {data:event}=await client.from('events').select('id').eq('id',eventId).eq('is_manual_entry',true).maybeSingle();
  if(!event)return Response.json({error:'Alleen voor handmatig ingevoerde vermeldingen.'},{status:400});
  const existing=await client.from('event_owner_access').select('event_id',{head:true,count:'exact'}).eq('event_id',eventId);
  if(existing.error)return Response.json({error:'Bestaande beheerrechten konden niet worden gecontroleerd.'},{status:502});
  if(existing.count)return Response.json({error:'Deze vermelding heeft al een beheerlink. Gebruik de bestaande link; een nieuwe link verstrekken vereist eerst gecontroleerd herstel. Er is niets gewijzigd.'},{status:409});
  const token=managedToken();const result=await client.from('event_owner_access').insert({event_id:eventId,token_hash:tokenHash(token)});
  if(result.error)return Response.json({error:'Beheerlink kon niet worden gemaakt.'},{status:502});
  return Response.json({manageFragment:`${eventId}:${token}`},{headers:{'Cache-Control':'no-store'}});
}
