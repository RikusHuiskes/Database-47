import {createServiceClient} from './supabase-server';
import {listingMail,mailConfiguration,mailTransport,safeMailError} from './mail';
import {openManagementMail,managementMailMessage,managementMailTokenHash,openSubmissionMail,submissionApprovedMessage} from './management-mail';
import {processAdvertisingInvoiceMailOutbox} from './advertising-invoices';
export async function processMailOutbox(limit=10,submissionId?:string){
 if(!mailConfiguration().deliveryEnabled)return {enabled:false,accepted:0,failed:0,invoiceAccepted:0,invoiceFailed:0};
 const client=createServiceClient();if(!client)throw Error('Serververbinding ontbreekt.');
 const {data,error}=submissionId
  ?await client.rpc('claim_submission_approval_mail',{p_event_id:submissionId})
  :await client.rpc('claim_listing_mail_v2',{p_limit:Math.min(10,Math.max(1,limit))});
 if(error)throw Error('De e-mailwachtrij kon niet worden geopend.');
 let accepted=0,failed=0;
 for(const row of data??[]){
  try{
   const config=mailConfiguration(),management=row.template==='management',submission=management&&row.payload?.purpose==='submission_approved';
   let message;
   if(management){
    const access=submission?openSubmissionMail(row.encrypted_secret,row.event_id):openManagementMail(row.encrypted_secret);
    const match=await client.from('event_owner_access').select('event_id').eq('event_id',access.eventId).eq('token_hash',managementMailTokenHash(access)).maybeSingle();
    if(match.error)throw Error('Beheerlink controleren mislukt.');
    if(!match.data){await client.from('listing_mail_outbox').update({state:'failed',encrypted_secret:null,last_error:'Deze beheerlink is vervangen of ingetrokken.',lease_token:null}).eq('id',row.id).eq('lease_token',row.lease_token);failed++;continue;}
    if(access.eventId!==row.payload?.eventId)throw Error('Onjuiste beheerlink.');
    if(submission){
     const listing=await client.from('events').select('status,verified').eq('id',access.eventId).maybeSingle();
     if(listing.error)throw Error('Goedkeuring controleren mislukt.');
     if(listing.data?.status!=='approved'||listing.data?.verified!==true){
      await client.from('listing_mail_outbox').update({state:'pending',attempts:Math.max(0,row.attempts-1),lease_token:null,next_attempt_at:new Date(Date.now()+60000).toISOString()}).eq('id',row.id).eq('lease_token',row.lease_token);
      continue;
     }
    }
    message=submission?submissionApprovedMessage(access,String(row.payload.title||'Votre annonce'),row.payload.locale):managementMailMessage(access,String(row.payload.title||'Je vermelding'));
   }else message=listingMail(row.template,row.payload);
   // Only independently confirmed management recipients receive real mail on preview.
   const redirect=(config.previewMode&&submission)||(!management&&(config.previewMode||row.payload?.audience==='admin'));
   const recipient=redirect?config.user:row.recipient;
   const outgoing=config.previewMode&&redirect?{subject:'[TEST PREVIEW] '+message.subject,text:'TESTBERICHT — uitsluitend naar de eigen Strato-mailbox.\nOorspronkelijke ontvanger: '+row.recipient+'\n\n'+message.text}:message;
   const info=await mailTransport().sendMail({from:config.from,to:recipient,replyTo:config.user,...outgoing,messageId:`<listing-${row.id}@cotededuras.com>`});
   if(!info.accepted?.length)throw Error('Geen ontvanger geaccepteerd.');
   const update=await client.from('listing_mail_outbox').update({state:'accepted',accepted_at:new Date().toISOString(),last_error:null,lease_token:null,...(management?{encrypted_secret:null}:{})}).eq('id',row.id).eq('lease_token',row.lease_token);
   if(update.error)throw Error('Verzendstatus kon niet worden opgeslagen.');
   accepted++;
  }catch(error){
   failed++;
   await client.from('listing_mail_outbox').update({state:row.attempts>=5?'failed':'pending',last_error:safeMailError(error),next_attempt_at:new Date(Date.now()+Math.min(1440,5*2**row.attempts)*60000).toISOString(),lease_token:null}).eq('id',row.id).eq('lease_token',row.lease_token);
  }
 }
 const invoices=submissionId?{accepted:0,failed:0}:await processAdvertisingInvoiceMailOutbox(limit);
 return {enabled:true,accepted,failed,invoiceAccepted:invoices.accepted,invoiceFailed:invoices.failed};
}
