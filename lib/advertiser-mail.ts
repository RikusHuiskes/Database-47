import type {SupabaseClient} from '@supabase/supabase-js';
import {loadAdvertisingInvoiceProfile,processAdvertisingInvoiceMailOutbox} from './advertising-invoices';
import {openManagementMail} from './management-mail';
import {mailConfiguration,mailTransport,safeMailError} from './mail';
export async function advertiserLink(db:SupabaseClient,requestId:string){
 const {data,error}=await db.from('advertiser_access').select('encrypted_secret').eq('request_id',requestId).maybeSingle();if(error)throw Error('Betaallink niet beschikbaar.');if(!data)return null;
 const access=openManagementMail(data.encrypted_secret);if(access.eventId!==requestId)throw Error('Ongeldige betaallink.');
 return access.origin+'/adverteren/betaling#'+requestId+':'+access.token;
}
export async function ensureAdvertiserInvoice(db:SupabaseClient,id:string){
 const order=await db.from('advertising_requests').select('payment_status,is_test_mode').eq('id',id).single();if(order.error||order.data.payment_status!=='paid')return;
 const access=await db.from('advertiser_access').select('request_id').eq('request_id',id).maybeSingle();if(access.error||!access.data)return;
 const existing=await db.from('advertising_invoices').select('id').eq('request_id',id).maybeSingle();if(existing.error)throw existing.error;if(existing.data)return;
 const profile=await loadAdvertisingInvoiceProfile(db);if(!profile.profile)throw Error('Factuurinstellingen ontbreken.');
 const issued=await db.rpc('issue_advertising_invoice',{p_request_id:id,p_profile:profile.profile,p_test_mode:order.data.is_test_mode});if(issued.error){const retry=await db.from('advertising_invoices').select('id').eq('request_id',id).maybeSingle();if(!retry.data)throw Error('Factuur kon niet worden aangemaakt.');}
}
export async function processAdvertiserMail(db:SupabaseClient,limit=10){
 const paid=await db.from('advertiser_access').select('request_id,advertising_requests!inner(payment_status)').eq('advertising_requests.payment_status','paid').limit(100);for(const row of paid.data??[])await ensureAdvertiserInvoice(db,row.request_id).catch(()=>{});await processAdvertisingInvoiceMailOutbox(limit).catch(()=>{});
 const config=mailConfiguration();if(!config.deliveryEnabled)return {accepted:0,failed:0};
 const now=new Date().toISOString();const rows=await db.from('advertiser_access').select('request_id,locale,mail_attempts').in('mail_state',['pending','sending','failed']).lt('mail_attempts',5).or('mail_lease.is.null,mail_lease.lt.'+now).limit(limit);if(rows.error)throw Error('Advertentiemails niet beschikbaar.');let accepted=0,failed=0;
 for(const row of rows.data??[]){
 const lease=new Date(Date.now()+300000).toISOString();const claim=await db.from('advertiser_access').update({mail_state:'sending',mail_lease:lease,mail_attempts:row.mail_attempts+1}).eq('request_id',row.request_id).eq('mail_attempts',row.mail_attempts).or('mail_lease.is.null,mail_lease.lt.'+now).select('request_id').maybeSingle();if(!claim.data)continue;
 try{const order=await db.from('advertising_requests').select('details,is_test_mode').eq('id',row.request_id).single();if(order.error)throw order.error;const link=await advertiserLink(db,row.request_id);if(!link)throw Error('Betaallink ontbreekt.');
 const subject=row.locale==='nl'?'Je advertentie en betalingen':row.locale==='en'?'Your advertising and payments':'Votre publicité et vos paiements';
 const text=row.locale==='nl'?'Met deze persoonlijke link kun je betalen, facturen bekijken en je maandabonnement opzeggen. De link geeft geen toegang om de bedrijfsvermelding te wijzigen. Bewaar hem als een wachtwoord.':row.locale==='en'?'Use this private link to pay, view invoices and cancel your monthly subscription. It does not allow changes to the business listing. Keep it like a password.':'Ce lien personnel permet de payer, consulter les factures et résilier votre abonnement mensuel. Il ne permet pas de modifier la fiche de l’entreprise. Conservez-le comme un mot de passe.';
 const info=await mailTransport().sendMail({from:config.from,to:config.previewMode||order.data.is_test_mode?config.user:order.data.details.email,replyTo:config.user,subject:(config.previewMode?'[TEST PREVIEW] ':'')+'Côte de Duras — '+subject,text:subject+'\n\n'+text+'\n\n'+link+'\n\ninfo@cotededuras.com',messageId:'<advertiser-'+row.request_id+'@cotededuras.com>'});if(!info.accepted?.length)throw Error('Mail niet geaccepteerd.');await db.from('advertiser_access').update({mail_state:'accepted',mail_lease:null,mail_error:null}).eq('request_id',row.request_id).eq('mail_lease',lease);accepted++;
 }catch(e){failed++;await db.from('advertiser_access').update({mail_state:'failed',mail_lease:new Date(Date.now()+3600000).toISOString(),mail_error:safeMailError(e)}).eq('request_id',row.request_id).eq('mail_lease',lease);}
 }return {accepted,failed};
}
