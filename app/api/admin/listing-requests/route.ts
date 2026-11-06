export const maxDuration=300;
import {after} from 'next/server';
import {listingTriage} from '../../../../lib/listing-triage';
import {adminService} from '../../../../lib/admin-service';
import {managedToken,tokenHash} from '../../../../lib/managed-events';
import {sealManagementMail} from '../../../../lib/management-mail';
import {mailConfiguration} from '../../../../lib/mail';
import {processMailOutbox} from '../../../../lib/mail-outbox';
export async function GET(request:Request) {
  const client=await adminService(request);
  if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
  const mailFor=new URL(request.url).searchParams.get('mailFor');
  if(mailFor){
    if(!/^[a-f\d-]{36}$/i.test(mailFor))return Response.json({error:'Ongeldige aanvraag.'},{status:400});
    const result=await client.from('listing_mail_outbox').select('id,state,recipient,accepted_at,last_error,next_attempt_at').eq('request_id',mailFor).eq('template','management').order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(result.error)return Response.json({error:'Verzendstatus kon niet worden geladen.'},{status:502});
    return Response.json({mail:result.data},{headers:{'Cache-Control':'no-store'}});
  }
  const page=Math.max(1,Math.min(10000,Number(new URL(request.url).searchParams.get('page'))||1));
  const status=new URL(request.url).searchParams.get('status')??'pending';
  if(!['pending','approved','rejected','resolved','revoked','all'].includes(status))return Response.json({error:'Ongeldige selectie.'},{status:400});
  let query=client.from('listing_requests').select('*,events(title,source_url,website_url,contact_phone),listing_review_history(action,note,contact,created_at)',{count:'exact'});
  if(status!=='all')query=query.eq('status',status);
  const [result,claims,corrections]=await Promise.all([query.order('created_at',{ascending:status==='pending'}).range((page-1)*10,page*10-1),client.from('listing_requests').select('id',{count:'exact',head:true}).eq('status','pending').eq('kind','claim'),client.from('listing_requests').select('id',{count:'exact',head:true}).eq('status','pending').eq('kind','correction')]);
  if(result.error)return Response.json({error:'Aanvragen konden niet worden geladen.'},{status:502});
  const accessResult=result.data?.length?await client.from('event_owner_access').select('event_id').in('event_id',result.data.map(item=>item.event_id)):{data:[],error:null};
  if(accessResult.error)return Response.json({error:'Bestaande beheerrechten konden niet worden gecontroleerd.'},{status:502});
  const mailResult=result.data?.length?await client.from('listing_mail_outbox').select('request_id,state,recipient,accepted_at,last_error').eq('template','management').in('request_id',result.data.map(item=>item.id)).order('created_at',{ascending:false}):{data:[],error:null};
  if(mailResult.error)return Response.json({error:'De verzendstatus kon niet worden gecontroleerd.'},{status:502});
  const managedIds=new Set(accessResult.data?.map(row=>row.event_id));
  const managedCounts=new Map<string,number>();for(const row of accessResult.data??[])managedCounts.set(row.event_id,(managedCounts.get(row.event_id)??0)+1);
  return Response.json({items:result.data?.map(item=>({...item,managementMail:mailResult.data?.find(mail=>mail.request_id===item.id),existingAccessCount:managedCounts.get(item.event_id)??0,hasExistingAccess:managedIds.has(item.event_id),triage:listingTriage(item)})),total:result.count,queue:{claims:claims.count??0,corrections:corrections.count??0}},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
  const client=await adminService(request);
  if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
  try {
    const text=await request.text();if(text.length>8000)throw Error('De invoer is te groot.');
    const body=JSON.parse(text),token=managedToken();
    if(!['approved','reissued','rejected','resolved','revoked'].includes(body.action))throw Error('Kies een geldige actie.');
    const reviewer=await client.auth.getUser(request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')??'');
    if(!reviewer.data.user)return Response.json({error:'Log opnieuw in.'},{status:403});
    const grants=['approved','reissued'].includes(body.action);
    const args={p_id:body.id,p_action:body.action,p_note:body.note??'',p_contact:body.contact??'',p_token_hash:tokenHash(token),p_reviewer:reviewer.data.user.id};
    let eventId:string;
    let mail:{state:string;recipient:string}|undefined;
    const deliveryEnabled=mailConfiguration().deliveryEnabled;
    if(grants){
      const email=String(body.deliveryEmail??'').trim().toLowerCase();
      if(body.emailConfirmed!=='on'||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||email.length>254)throw Error('Controleer en bevestig het e-mailadres voor de persoonlijke beheerlink.');
      const listing=await client.from('listing_requests').select('event_id').eq('id',body.id).maybeSingle();
      if(listing.error||!listing.data)throw Error('Aanvraag niet gevonden.');
      const origin=new URL(request.url).origin;
      if(!origin.startsWith('https://'))throw Error('Open de beveiligde website om een beheerlink te versturen.');
      const result=await client.rpc('review_listing_request_with_mail',{
        ...args,p_email:email,
        p_encrypted_secret:sealManagementMail({eventId:listing.data.event_id,token,origin})
      });
      if(result.error)throw Error(result.error.message);
      eventId=result.data.eventId;
      mail={state:'pending',recipient:email};
    }else{
      const result=await client.rpc('review_listing_request',args);
      if(result.error)throw Error(result.error.message);
      eventId=result.data;
    }
    // A mail failure must not turn an already committed decision into a failed save.
    if(deliveryEnabled)after(async()=>{try{await processMailOutbox(10);}catch{console.error('De opgeslagen beheerbeslissing wacht nog op mailverwerking.');}});
    return Response.json({ok:true,manageFragment:grants?`${eventId}:${token}`:undefined,mail,mailDeliveryEnabled:deliveryEnabled},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Verwerken mislukt.'},{status:400});}
}
