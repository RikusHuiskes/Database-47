import {adminService} from '../../../../lib/admin-service';
import {scheduleListingMail} from '../../../../lib/schedule-listing-mail';
export const runtime='nodejs';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
 try{
  const raw=await request.text();if(raw.length>1000)throw Error('De invoer is te groot.');
  const {id,status}=JSON.parse(raw);
  if(typeof id!=='string'||! /^[a-f\d-]{36}$/i.test(id)||!['approved','rejected'].includes(status))throw Error('Kies een vermelding en beslissing.');
  // Approval and the mail enqueue are one database transaction via the trigger.
  const result=await client.from('events').update({status,verified:status==='approved',updated_at:new Date().toISOString()}).eq('id',id).select('id,promotion_status').maybeSingle();
  if(result.error)throw Error('De beslissing kon niet worden opgeslagen.');
  if(!result.data)return Response.json({error:'De vermelding is niet gevonden.'},{status:404});
  if(status==='approved')scheduleListingMail(id);
  return Response.json(result.data,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Opslaan mislukt.'},{status:400});}
}
