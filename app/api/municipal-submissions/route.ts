import {createServiceClient} from '../../../lib/supabase-server';
import {managedToken,tokenHash} from '../../../lib/managed-events';
import {municipalSubmission} from '../../../lib/municipal-submission';
export const runtime='nodejs';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 const client=createServiceClient();if(!client)return Response.json({error:'De database is tijdelijk niet beschikbaar.'},{status:503});
 try{
  const raw=await request.text();if(raw.length>20000)throw Error('De invoer is te groot.');
  const id=crypto.randomUUID(),token=managedToken(),row=municipalSubmission(JSON.parse(raw),id,process.env.NEXT_PUBLIC_SUPABASE_URL);
  const saved=await client.from('events').insert(row);
  if(saved.error){console.error('[municipal-submission] insert failed',saved.error.code);throw Error('De bedrijfsvermelding kon niet worden opgeslagen. Probeer het opnieuw.');}
  const access=await client.from('event_owner_access').insert({event_id:id,token_hash:tokenHash(token)});
  if(access.error){
   // A failed access setup must not leave a public or unmanageable submission.
   const cleanup=await client.from('events').delete().eq('id',id).eq('municipal_key',row.municipal_key).eq('status','pending');
   console.error('[municipal-submission] access setup failed',access.error.code,{cleanupFailed:!!cleanup.error});
   throw Error('De beheerlink kon niet worden aangemaakt. Probeer het later opnieuw.');
  }
  return Response.json({eventId:id,manageFragment:id+':'+token},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Opslaan mislukt.'},{status:400});}
}
