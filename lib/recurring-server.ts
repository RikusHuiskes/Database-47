import type {SupabaseClient} from '@supabase/supabase-js';
import {mollieRequest} from './mollie';
import {FIRST_SEPA_METHODS,verifiedRecurringPayment,type RecurringPayment,type RecurringMethod} from './recurring-billing';
import {createServiceClient} from './supabase-server';
import {loadAdvertisingInvoiceProfile} from './advertising-invoices';
import {mailConfiguration,mailTransport,safeMailError} from './mail';
export type Contract={id:string;request_id:string;event_id:string;method:RecurringMethod;amount_cents:number;anchor_date:string;paid_until:string|null;customer_id:string;mandate_id:string|null;is_test_mode:boolean;status:string;locale:'nl'|'en'|'fr'};
export type Cycle={id:string;contract_id:string;cycle_index:number;request_id:string;starts_on:string;ends_on:string;charge_on:string;payment_id:string|null;checkout_key:string;state:string};
export const parisToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function billingOrigin(request?:Request){
 const value=process.env.VERCEL_ENV==='preview'?request?.url||process.env.PUBLIC_SITE_URL:process.env.PUBLIC_SITE_URL||request?.url;
 if(!value||!value.startsWith('https://'))throw Error('De publieke betaalomgeving is nog niet ingesteld.');return new URL(value).origin;
}
export async function contractCycle(db:SupabaseClient,contractId:string,index=0){
 const [a,b]=await Promise.all([db.from('advertising_contracts').select('*').eq('id',contractId).single(),db.from('advertising_billing_cycles').select('*').eq('contract_id',contractId).eq('cycle_index',index).single()]);
 if(a.error||b.error)throw Error('Het abonnement kon niet worden geladen.');return {contract:a.data as Contract,cycle:b.data as Cycle};
}
export async function firstMethods(method:RecurringMethod,amount:number){
 const params=new URLSearchParams({sequenceType:'first','amount[currency]':'EUR','amount[value]':(amount/100).toFixed(2)});
 const data=await mollieRequest('methods?'+params);
 const active=(data._embedded?.methods??[]).map((x:{id:string})=>x.id) as string[];
 const methods=method==='creditcard'?active.filter(x=>x==='creditcard'):active.filter(x=>FIRST_SEPA_METHODS.includes(x));
 if(!methods.length)throw Error(method==='creditcard'?'Creditcard is niet beschikbaar voor deze eerste betaling.':'Er is nog geen bankbetaalmethode voor een SEPA-machtiging beschikbaar. Neem contact op met Côte de Duras.');return methods;
}
export async function reconcileMonthlyPayment(db:SupabaseClient,id:string){
 const payment=await mollieRequest('payments/'+encodeURIComponent(id)) as RecurringPayment;
 const cycleId=payment.metadata?.cycleId,contractId=payment.metadata?.contractId;
 if(!cycleId||!contractId)throw Error('Onbekende abonnementsbetaling.');
 const [{data:c,error:ce},{data:b,error:be}]=await Promise.all([db.from('advertising_contracts').select('*').eq('id',contractId).single(),db.from('advertising_billing_cycles').select('*').eq('id',cycleId).eq('contract_id',contractId).single()]);
 if(ce||be)throw Error('Onbekende abonnementsbetaling.');const contract=c as Contract,cycle=b as Cycle;
 const state=verifiedRecurringPayment(payment,contract,cycle);
 let mandateId:string|null=null;
 if(state==='paid'){
  if(!payment.mandateId)throw Error('Machtiging ontbreekt bij de abonnementsbetaling.');
  const mandate=await mollieRequest('customers/'+encodeURIComponent(contract.customer_id)+'/mandates/'+encodeURIComponent(payment.mandateId));
  if(mandate.status!=='valid'||mandate.method!==(contract.method==='creditcard'?'creditcard':'directdebit'))throw Error('De machtiging is nog niet geldig.');
  mandateId=mandate.id;
 }
 const applied=await db.rpc('apply_monthly_payment',{p_cycle_id:cycle.id,p_payment_id:payment.id,p_state:state,p_mandate_id:mandateId});if(applied.error)throw Error('De abonnementsbetaling kon niet worden verwerkt.');
 if(state==='paid'){
  const profile=await loadAdvertisingInvoiceProfile(db);if(!profile.profile)throw Error('Factuurinstellingen ontbreken.');
  const invoice=await db.from('advertising_invoices').select('id').eq('request_id',cycle.request_id).maybeSingle();if(invoice.error)throw Error('Factuurcontrole mislukt.');
  let invoiceId=invoice.data?.id;
  if(!invoiceId){const issued=await db.rpc('issue_advertising_invoice',{p_request_id:cycle.request_id,p_profile:profile.profile,p_test_mode:contract.is_test_mode});if(issued.error){const existing=await db.from('advertising_invoices').select('id').eq('request_id',cycle.request_id).maybeSingle();if(!existing.data)throw Error('De maandfactuur kon niet worden aangemaakt.');invoiceId=existing.data.id;}else invoiceId=issued.data;}
  await db.from('advertising_billing_cycles').update({invoice_id:invoiceId}).eq('id',cycle.id);
  // Durable recovery: the daily processor retries reservation independently of this callback.
  await db.rpc('reserve_monthly_cycle',{p_contract_id:contract.id});
 }
 return {paymentStatus:state};
}

function billingMail(kind:string,c:Contract,b:Cycle|null){
 const lang=c.locale,amount=new Intl.NumberFormat(lang==='nl'?'nl-NL':lang==='en'?'en-GB':'fr-FR',{style:'currency',currency:'EUR'}).format(c.amount_cents/100);
 const date=(value:string|null)=>value?new Intl.DateTimeFormat(lang==='nl'?'nl-NL':lang==='en'?'en-GB':'fr-FR',{dateStyle:'long',timeZone:'Europe/Paris'}).format(new Date(value+'T12:00:00Z')):'—';
 const method=lang==='fr'?(c.method==='sepa'?'prélèvement SEPA':'carte bancaire'):lang==='en'?(c.method==='sepa'?'SEPA direct debit':'credit card'):(c.method==='sepa'?'SEPA-incasso':'creditcard');
 const titles={nl:{confirmed:'Maandabonnement bevestigd',upcoming:'Aankondiging maandbetaling',failed:'Maandbetaling vraagt aandacht',cancelled:'Maandabonnement opgezegd'},en:{confirmed:'Monthly subscription confirmed',upcoming:'Upcoming monthly payment',failed:'Monthly payment needs attention',cancelled:'Monthly subscription cancelled'},fr:{confirmed:'Abonnement mensuel confirmé',upcoming:'Avis de paiement mensuel',failed:'Paiement mensuel à vérifier',cancelled:'Abonnement mensuel résilié'}};
 const terms={nl:`Je betaalt ${amount} per maand via ${method}. Je kunt maandelijks opzeggen in je persoonlijke beheeromgeving. Na opzegging starten we geen nieuwe betalingen. Een al gestarte betaling kan nog worden verwerkt. Je advertentie blijft actief voor de betaalde periode.`,en:`You pay ${amount} per month by ${method}. You can cancel monthly in your personal management area. After cancellation we will not initiate new payments. A payment already initiated may still be processed. Your advertisement remains active for the paid period.`,fr:`Vous payez ${amount} par mois par ${method}. Vous pouvez résilier chaque mois dans votre espace de gestion personnel. Après résiliation, nous n'initierons plus de nouveaux paiements. Un paiement déjà engagé peut encore être traité. Votre publicité reste active pendant la période payée.`};
 const notice=lang==='nl'?`Geplande afschrijving: ${date(b?.charge_on??null)}. Periode: ${date(b?.starts_on??null)} – ${date(b?.ends_on??null)}.`:lang==='en'?`Scheduled payment: ${date(b?.charge_on??null)}. Period: ${date(b?.starts_on??null)} – ${date(b?.ends_on??null)}.`:`Paiement prévu le ${date(b?.charge_on??null)}. Période : ${date(b?.starts_on??null)} – ${date(b?.ends_on??null)}.`;
 const paid=lang==='nl'?`Betaald tot: ${date(c.paid_until)}.`:lang==='en'?`Paid until: ${date(c.paid_until)}.`:`Payé jusqu'au ${date(c.paid_until)}.`;
 return {subject:'Côte de Duras — '+titles[lang][kind as keyof typeof titles.nl],text:[titles[lang][kind as keyof typeof titles.nl],terms[lang],kind==='upcoming'?notice:paid,'https://www.cotededuras.com/mijn-vermelding','info@cotededuras.com','Référence: '+c.id].join('\n\n')};
}
export async function processBillingMail(db:SupabaseClient,limit=20){
 const config=mailConfiguration();if(!config.deliveryEnabled)return {accepted:0,failed:0};
 const now=new Date().toISOString();
 const found=await db.from('advertising_billing_mail').select('*').in('state',['pending','sending','failed']).lt('attempts',5).or('lease_until.is.null,lease_until.lt.'+now).order('created_at').limit(limit);if(found.error)throw Error('De abonnementsmail kon niet worden geladen.');
 let accepted=0,failed=0;
 for(const row of found.data??[]){
  const lease=new Date(Date.now()+300000).toISOString();let claim=db.from('advertising_billing_mail').update({state:'sending',attempts:row.attempts+1,lease_until:lease}).eq('id',row.id).eq('state',row.state).eq('attempts',row.attempts);claim=row.lease_until?claim.eq('lease_until',row.lease_until):claim.is('lease_until',null);
  const claimed=await claim.select('id').maybeSingle();if(claimed.error||!claimed.data)continue;
  try{
   const {data:c,error}=await db.from('advertising_contracts').select('*').eq('id',row.contract_id).single();if(error)throw error;
   const [{data:order},{data:cycle}]=await Promise.all([db.from('advertising_requests').select('details').eq('id',c.request_id).single(),row.cycle_id?db.from('advertising_billing_cycles').select('*').eq('id',row.cycle_id).single():Promise.resolve({data:null})]);
   if(!order?.details?.email)throw Error('Factuuradres ontbreekt.');
   // Suppress obsolete debit notices after cancellation; never let them authorize a charge.
   if(row.kind==='upcoming'&&c.status==='cancelled'){await db.from('advertising_billing_mail').update({state:'accepted',lease_until:null}).eq('id',row.id).eq('lease_until',lease);continue;}
   const message=billingMail(row.kind,c as Contract,cycle as Cycle|null);
   const info=await mailTransport().sendMail({from:config.from,to:config.previewMode||c.is_test_mode?config.user:order.details.email,replyTo:config.user,...message,subject:(config.previewMode||c.is_test_mode?'[TEST PREVIEW] ':'')+message.subject,messageId:'<billing-'+row.id+'@cotededuras.com>'});if(!info.accepted?.length)throw Error('Mail niet geaccepteerd.');
   const saved=await db.from('advertising_billing_mail').update({state:'accepted',accepted_at:new Date().toISOString(),lease_until:null,last_error:null}).eq('id',row.id).eq('lease_until',lease);if(saved.error)throw saved.error;
   if(row.kind==='upcoming'&&cycle)await db.from('advertising_billing_cycles').update({notice_accepted_at:new Date().toISOString()}).eq('id',cycle.id);
   accepted++;
  }catch(error){failed++;await db.from('advertising_billing_mail').update({state:'failed',lease_until:new Date(Date.now()+3600000).toISOString(),last_error:safeMailError(error)}).eq('id',row.id).eq('lease_until',lease);}
 }
 return {accepted,failed};
}
export async function processMonthlyBilling(limit=40){
 if(!process.env.MOLLIE_API_KEY)return {enabled:false};const db=createServiceClient();if(!db)throw Error('Serververbinding ontbreekt.');
 const mode=process.env.MOLLIE_API_KEY.startsWith('test_'),today=parisToday(),soon=new Date(Date.now()+3*86400000).toISOString().slice(0,10);let processed=0,errors=0;
 const recovery=await db.rpc('queue_monthly_cycles',{p_test:mode,p_limit:limit});if(recovery.error)throw Error('Abonnementsherstel is niet beschikbaar.');errors+=Number(recovery.data?.failed||0);
 const cycles=await db.from('advertising_billing_cycles').select('*,advertising_contracts!inner(*)').eq('advertising_contracts.is_test_mode',mode).or('and(cycle_index.gt.0,state.in.(planned,creating)),state.eq.open,and(state.eq.paid,invoice_id.is.null)').lte('charge_on',soon).order('charge_on').limit(limit);
 if(cycles.error)throw Error('De maandtermijnen konden niet worden geladen.');
 for(const row of cycles.data??[]){
  const c=row.advertising_contracts as Contract,b=row as Cycle;
  try{
   if(b.payment_id){if(b.state==='open'||b.state==='paid'&&!row.invoice_id)await reconcileMonthlyPayment(db,b.payment_id);continue;}
   if(b.cycle_index===0||c.status!=='active')continue;
   const notice=await db.from('advertising_billing_mail').upsert({contract_id:c.id,cycle_id:b.id,kind:'upcoming',dedupe_key:'upcoming:'+b.id},{onConflict:'dedupe_key',ignoreDuplicates:true});if(notice.error)throw notice.error;
  }catch{errors++;}
 }
 const mail=await processBillingMail(db,limit);
 for(const row of cycles.data??[]){
  const c=row.advertising_contracts as Contract,b=row as Cycle;if(b.cycle_index===0||b.payment_id||b.charge_on>today||c.status!=='active')continue;
  try{
   const claim=await db.rpc('claim_monthly_charge',{p_cycle_id:b.id});if(claim.error)throw claim.error;if(!claim.data)continue;
   if(!c.mandate_id)throw Error('Machtiging ontbreekt.');
   const mandate=await mollieRequest('customers/'+c.customer_id+'/mandates/'+c.mandate_id);
   if(mandate.status!=='valid'||mandate.method!==(c.method==='creditcard'?'creditcard':'directdebit')){
    await db.from('advertising_contracts').update({status:'past_due'}).eq('id',c.id).eq('status','active');
    await db.from('advertising_billing_mail').upsert({contract_id:c.id,cycle_id:b.id,kind:'failed',dedupe_key:'failed:'+b.id},{onConflict:'dedupe_key',ignoreDuplicates:true});continue;
   }
   const payment=await mollieRequest('payments',{method:'POST',headers:{'Idempotency-Key':b.checkout_key},body:JSON.stringify({amount:{currency:'EUR',value:(c.amount_cents/100).toFixed(2)},customerId:c.customer_id,mandateId:c.mandate_id,sequenceType:'recurring',method:c.method==='creditcard'?'creditcard':'directdebit',description:'Côte de Duras — '+b.starts_on+' / '+b.ends_on,webhookUrl:billingOrigin()+'/api/mollie/recurring/webhook',metadata:{contractId:c.id,cycleId:b.id}})});
   // Fetch and verify the provider record before accepting any result.
   await reconcileMonthlyPayment(db,payment.id);processed++;
  }catch{errors++;await db.from('advertising_billing_cycles').update({last_error:'Betaling vraagt controle. Er wordt geen nieuwe betaalreferentie aangemaakt.'}).eq('id',b.id);}
 }
 return {enabled:true,processed,errors,mail};
}
