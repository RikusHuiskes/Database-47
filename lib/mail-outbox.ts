import {createServiceClient} from './supabase-server';
import {listingMail,mailConfiguration,mailTransport,safeMailError} from './mail';
export async function processMailOutbox(limit=3){
 if(!mailConfiguration().deliveryEnabled)return {enabled:false,accepted:0,failed:0};
 const client=createServiceClient();if(!client)throw Error('Serververbinding ontbreekt.');
 const {data,error}=await client.rpc('claim_listing_mail',{p_limit:Math.min(10,Math.max(1,limit))});
 if(error)throw Error('De e-mailwachtrij kon niet worden geopend.');
 let accepted=0,failed=0;
 for(const row of data??[]){
  try{
   const message=listingMail(row.template,row.payload),config=mailConfiguration();
   const info=await mailTransport().sendMail({from:config.from,to:row.recipient,replyTo:config.user,...message,messageId:`<listing-${row.id}@cotededuras.com>`});
   if(!info.accepted?.length)throw Error('Geen ontvanger geaccepteerd.');
   const update=await client.from('listing_mail_outbox').update({state:'accepted',accepted_at:new Date().toISOString(),last_error:null,lease_token:null}).eq('id',row.id).eq('lease_token',row.lease_token);
   if(update.error)throw Error('Verzendstatus kon niet worden opgeslagen.');
   accepted++;
  }catch(error){
   failed++;
   await client.from('listing_mail_outbox').update({state:row.attempts>=5?'failed':'pending',last_error:safeMailError(error),next_attempt_at:new Date(Date.now()+Math.min(1440,5*2**row.attempts)*60000).toISOString(),lease_token:null}).eq('id',row.id).eq('lease_token',row.lease_token);
  }
 }
 return {enabled:true,accepted,failed};
}
