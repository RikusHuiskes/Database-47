import {managedAccess} from '../../../../../lib/managed-events';
import {mollieRequest} from '../../../../../lib/mollie';
import {isPaymentCheckoutUrl} from '../../../../../lib/payment-checkout-url';
import {contractCycle,firstMethods,billingOrigin,reconcileMonthlyPayment} from '../../../../../lib/recurring-server';
import {loadAdvertisingInvoiceProfile} from '../../../../../lib/advertising-invoices';
import {mailConfiguration} from '../../../../../lib/mail';
export const runtime='nodejs';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 try{
  const {eventId,requestId}=await request.json(),db=await managedAccess(request,eventId);if(!db)return Response.json({error:'Gebruik je persoonlijke beheerlink.'},{status:401});
  const found=await db.from('advertising_contracts').select('id').eq('request_id',requestId).eq('event_id',eventId).single();if(found.error)throw Error('Abonnement niet gevonden.');
  const {contract:c,cycle:b}=await contractCycle(db,found.data.id);
  if(c.status!=='checkout')throw Error('Dit abonnement is al gestart of stopgezet.');
  if(c.is_test_mode!==Boolean(process.env.MOLLIE_API_KEY?.startsWith('test_')))throw Error('Test- en livebetalingen kunnen niet worden gecombineerd.');
  const order=await db.from('advertising_requests').select('*').eq('id',requestId).eq('event_id',eventId).single();if(order.error)throw Error('Aanvraag niet gevonden.');
  if(order.data.ends_on<=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}).format(new Date()))throw Error('Deze aanvraag is verlopen. Maak een nieuwe aanvraag.');
  const profile=await loadAdvertisingInvoiceProfile(db);if(!profile.profile)throw Error('De factuurinstellingen zijn nog niet compleet. Neem contact op met Côte de Duras.');
  if(!mailConfiguration().deliveryEnabled)throw Error('De bevestigingsmail is nog niet ingericht. Neem contact op met Côte de Duras.');
  if(b.payment_id){
   const state=await reconcileMonthlyPayment(db,b.payment_id);if(state.paymentStatus==='paid')return Response.json({error:'De eerste maand is al betaald. Vernieuw de pagina.'},{status:409});
   const previous=await mollieRequest('payments/'+b.payment_id);
   if(previous.status==='open'&&isPaymentCheckoutUrl(previous._links?.checkout?.href))return Response.json({checkoutUrl:previous._links.checkout.href});
   throw Error('De eerste betaling is afgerond of verlopen. Neem contact op voor een nieuwe aanvraag.');
  }
  const methods=await firstMethods(c.method,c.amount_cents);
  for(const type of order.data.details.placements){const capacity=await db.rpc('assert_advertising_capacity',{p_event_id:eventId,p_placement:type,p_starts_on:c.anchor_date,p_ends_on:'9999-12-31'});if(capacity.error)throw Error(capacity.error.message);}
  const claim=await db.rpc('claim_monthly_first',{p_cycle_id:b.id});if(claim.error||!claim.data)throw Error('Deze betaling wordt al voorbereid of vraagt handmatige controle. Probeer het over enkele minuten opnieuw.');
  let customerId=c.customer_id;
  if(!customerId){
   const customer=await mollieRequest('customers',{method:'POST',headers:{'Idempotency-Key':'customer-'+c.id},body:JSON.stringify({name:order.data.details.company||order.data.details.name,email:order.data.details.email,metadata:{contractId:c.id}})});
   if(!/^cst_[A-Za-z0-9]+$/.test(customer.id))throw Error('Klantreferentie ontbreekt.');customerId=customer.id;
   const saved=await db.from('advertising_contracts').update({customer_id:customerId}).eq('id',c.id).is('customer_id',null);if(saved.error)throw Error('Klantreferentie kon niet worden opgeslagen.');
  }
  const redirect=new URL('/mijn-vermelding',new URL(request.url).origin);redirect.searchParams.set('betaling','terug');redirect.searchParams.set('aanvraag',requestId);
  const payment=await mollieRequest('payments',{method:'POST',headers:{'Idempotency-Key':b.checkout_key},body:JSON.stringify({amount:{currency:'EUR',value:(c.amount_cents/100).toFixed(2)},customerId,sequenceType:'first',method:c.method==='creditcard'?'creditcard':methods,description:'Côte de Duras — première mensualité — '+requestId.slice(0,8),locale:c.locale==='fr'?'fr_FR':c.locale==='en'?'en_GB':'nl_NL',redirectUrl:redirect.toString(),webhookUrl:billingOrigin(request)+'/api/mollie/recurring/webhook',metadata:{contractId:c.id,cycleId:b.id},billingAddress:{givenName:order.data.details.name,familyName:order.data.details.company||order.data.details.name,streetAndNumber:order.data.details.address,postalCode:order.data.details.postcode,city:order.data.details.city,country:order.data.details.country}})});
  if(!/^tr_[A-Za-z0-9]+$/.test(payment.id)||!isPaymentCheckoutUrl(payment._links?.checkout?.href))throw Error('Ongeldige betaalverwijzing.');
  const saved=await db.from('advertising_billing_cycles').update({payment_id:payment.id,state:'open',attempted_at:new Date().toISOString()}).eq('id',b.id).is('payment_id',null).eq('state','creating');if(saved.error)throw Error('De betaalreferentie kon niet worden opgeslagen.');
  // Reservation and initial order stay connected for the existing payment overview.
  const linked=await db.from('advertising_requests').update({mollie_payment_id:payment.id,payment_status:'open'}).eq('id',requestId).eq('payment_status','requested');if(linked.error)throw Error('De betaalreferentie kon niet worden gekoppeld.');
  return Response.json({checkoutUrl:payment._links.checkout.href});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Abonnement niet beschikbaar.'},{status:502});}
}
