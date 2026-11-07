import {createServiceClient} from '../../../lib/supabase-server';
import {managedToken,tokenHash} from '../../../lib/managed-events';
import {municipalSubmission} from '../../../lib/municipal-submission';
import {submissionContact} from '../../../lib/submission-contact';
export const runtime='nodejs';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 const client=createServiceClient();if(!client)return Response.json({error:'De database is tijdelijk niet beschikbaar.'},{status:503});
 try{
  const raw=await request.text();if(raw.length>20000)throw Error('De invoer is te groot.');
  const input=JSON.parse(raw),id=crypto.randomUUID(),token=managedToken(),row=municipalSubmission(input,id,process.env.NEXT_PUBLIC_SUPABASE_URL);
  const contact=submissionContact(input.ownerEmail,input.locale,token,new URL(request.url).origin);
  const saved=await client.rpc('submit_municipal_listing_with_contact',{p_event:row,p_token_hash:tokenHash(token),p_contact:contact});
  if(saved.error){console.error('[municipal-submission] insert failed',saved.error.code);throw Error('De bedrijfsvermelding kon niet worden opgeslagen. Probeer het opnieuw.');}
  return Response.json({eventId:id,manageFragment:id+':'+token},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Opslaan mislukt.'},{status:400});}
}
