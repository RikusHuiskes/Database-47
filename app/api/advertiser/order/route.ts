import {after} from 'next/server';
import {createHash} from 'node:crypto';
import {createServiceClient} from '../../../../lib/supabase-server';
import {advertiserAccess} from '../../../../lib/advertiser-access';
import {tokenHash} from '../../../../lib/managed-events';
import {validateAdvertiser,advertisingSelectionQuote} from '../../../../lib/advertising';
import {recurringMethod,BILLING_TERMS_VERSION} from '../../../../lib/recurring-billing';
import {firstMethods} from '../../../../lib/recurring-server';
import {loadAdvertisingInvoiceProfile} from '../../../../lib/advertising-invoices';
import {mailConfiguration} from '../../../../lib/mail';
import {sealManagementMail} from '../../../../lib/management-mail';
import {processAdvertiserMail} from '../../../../lib/advertiser-mail';
import {POST as checkout} from '../checkout/route';
export const runtime='nodejs';
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('id')??'',db=await advertiserAccess(request,id);if(!db)return Response.json({error:'Open je persoonlijke betaallink.'},{status:401});
 const order=await db.from('advertising_requests').select('id,event_id,placement,details,amount_cents,payment_status,starts_on,ends_on,months,events(title,city)').eq('id',id).single();
 if(order.error)return Response.json({error:'Advertentie niet gevonden.'},{status:404});
 const contract=await db.from('advertising_contracts').select('id,method,status,amount_cents,paid_until').eq('request_id',id).maybeSingle();if(contract.error)return Response.json({error:'Abonnement niet beschikbaar.'},{status:503});
 const cycles=contract.data?await db.from('advertising_billing_cycles').select('request_id,cycle_index,state,starts_on,ends_on').eq('contract_id',contract.data.id).order('cycle_index'):null;
 if(cycles?.error)return Response.json({error:'Betaalperioden niet beschikbaar.'},{status:503});
 const ids=cycles?.data?.map(x=>x.request_id)??[id];
 const invoices=await db.from('advertising_invoices').select('id,invoice_number,total_cents,issued_at').in('request_id',ids);if(invoices.error)return Response.json({error:'Facturen niet beschikbaar.'},{status:503});
 return Response.json({order:order.data,contract:contract.data,cycles:cycles?.data??[],invoices:invoices.data??[]},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 try{const raw=await request.text();if(raw.length>12000)throw Error('De invoer is te groot.');const b=JSON.parse(raw);
 if(b.website||! /^[a-f0-9-]{36}$/i.test(b.requestId??'')||! /^[a-f0-9-]{36}$/i.test(b.eventId??'')||! /^[A-Za-z0-9_-]{43}$/.test(b.purchaseKey??''))throw Error('Ongeldige aanvraag.');
 const monthly=b.billingMode==='monthly';if(!monthly&&b.billingMode!=='once')throw Error('Kies je betaalvorm.');if(monthly&&(b.consent!==true||b.termsVersion!==BILLING_TERMS_VERSION))throw Error('Geef toestemming voor de maandelijkse betalingen.');if(monthly)recurringMethod(b.method);
 const {details}=validateAdvertiser(b.placements?.[0],{...b.advertiser,months:monthly?1:b.advertiser?.months});const quote=advertisingSelectionQuote(b.placements,details);const db=createServiceClient();if(!db)throw Error('De database is tijdelijk niet beschikbaar.');
 if(!mailConfiguration().deliveryEnabled)throw Error('De bevestigingsmail is tijdelijk niet beschikbaar. Probeer het later opnieuw.');if(!(await loadAdvertisingInvoiceProfile(db)).profile)throw Error('Factuurinstellingen ontbreken.');if(monthly)await firstMethods(recurringMethod(b.method),quote.amountCents);
 const origin=new URL(request.url).origin,locale=['nl','en'].includes(b.locale)?b.locale:'fr';const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
 const result=await db.rpc('request_public_advertising',{p_id:b.requestId,p_event_id:b.eventId,p_token_hash:tokenHash(b.purchaseKey),p_secret:sealManagementMail({eventId:b.requestId,token:b.purchaseKey,origin}),p_locale:locale,p_rate_key:hash(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown'),p_email_key:hash(details.email.toLowerCase()),p_ad:{...quote,details:{...details,placements:quote.placements}},p_test:Boolean(process.env.MOLLIE_API_KEY?.startsWith('test_')),p_monthly:monthly,p_method:monthly?b.method:null,p_terms:monthly?BILLING_TERMS_VERSION:null});
 if(result.error)throw Error(result.error.message);
 after(async()=>{await processAdvertiserMail(db,10).catch(()=>{});});
 const response=await checkout(new Request(new URL('/api/advertiser/checkout',origin),{method:'POST',headers:{origin,'Content-Type':'application/json',Authorization:'Bearer '+b.purchaseKey},body:JSON.stringify({eventId:b.eventId,requestId:b.requestId})}));const data=await response.json();
 return Response.json({...data,requestId:b.requestId,saved:true},{status:response.ok?201:409,headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Advertentie aanvragen mislukt.'},{status:400});}
}
