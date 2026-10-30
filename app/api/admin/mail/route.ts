import {processMailOutbox} from '../../../../lib/mail-outbox';
import {adminService} from '../../../../lib/admin-service';
import {mailConfiguration,mailTransport,safeMailError} from '../../../../lib/mail';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
 const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
 const config=mailConfiguration();
 const states=['pending','sending','accepted','failed'];
 const counts=await Promise.all(states.map(state=>client.from('listing_mail_outbox').select('id',{count:'exact',head:true}).eq('state',state)));
 return Response.json({configured:config.configured,missing:config.missing,deliveryEnabled:config.deliveryEnabled,previewMode:config.previewMode,testRecipient:config.user,queue:counts.some(row=>row.error)?null:Object.fromEntries(states.map((state,i)=>[state,counts[i].count??0]))},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
 try{
  const body=await request.json();if(!['verify','test','process'].includes(body.action))return Response.json({error:'Ongeldige actie.'},{status:400});
  const config=mailConfiguration();if(!config.configured)return Response.json({error:'De Strato-instellingen zijn onvolledig of ongeldig.'},{status:503});
  if(body.action==='process'){const result=await processMailOutbox(10);return Response.json({message:result.enabled?`${result.accepted} berichten door Strato geaccepteerd; ${result.failed} mislukt. ${config.previewMode?'Alle testberichten zijn uitsluitend naar de eigen mailbox gestuurd.':''}`:'Automatische verzending is uitgeschakeld.'});}
  const transport=mailTransport();
  if(body.action==='verify'){await transport.verify();return Response.json({message:'De beveiligde verbinding en aanmelding bij Strato werken. Er is geen mail verstuurd.'},{headers:{'Cache-Control':'no-store'}});}
  // A test can only go to our own configured mailbox, never a supplied recipient.
  const info=await transport.sendMail({from:config.from,to:config.user,replyTo:config.user,subject:'Côte de Duras — test van de Strato-mailkoppeling',text:'Dit is een testbericht van de Database47-mailkoppeling.\n\nStrato heeft dit bericht geaccepteerd voor verzending via een beveiligde verbinding. Controleer of het in je inbox of spammap aankomt. Deze test verleent geen beheerrechten en verandert geen vermeldingen.\n\nCôte de Duras'});
  if(!info.accepted?.length)throw Error('Niet geaccepteerd.');
  return Response.json({message:'Strato heeft de testmail geaccepteerd voor '+config.user+'. Controleer je inbox en spammap; acceptatie is nog geen bevestiging van aflevering.'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:safeMailError(error)},{status:502});}
}
