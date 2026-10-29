import {managedAccess} from '../../../../lib/managed-events';
import {mollieRequest,verifiedPaymentState} from '../../../../lib/mollie';
export const runtime='nodejs';
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
  try{
    const {eventId}=await request.json(),client=await managedAccess(request,eventId);
    if(!client)return Response.json({error:'Gebruik je persoonlijke beheerlink.'},{status:401});
    if(!process.env.MOLLIE_API_KEY)return Response.json({error:'Online betalen is nog niet geactiveerd. Je aanvraag blijft bewaard.'},{status:503});
    let {data:order,error}=await client.from('advertising_requests').select('*').eq('event_id',eventId).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(error||!order)throw Error('Advertentieaanvraag niet gevonden.');
    if(order.payment_status==='paid')return Response.json({error:'Deze aanvraag is al betaald.'},{status:409});
    if(new Date(order.ends_on+'T00:00:00Z')<=new Date())return Response.json({error:'De advertentieperiode is verstreken. Neem contact op voor een nieuwe periode.'},{status:409});
    if(order.mollie_payment_id){
      const previous=await mollieRequest('payments/'+encodeURIComponent(order.mollie_payment_id));
      const state=verifiedPaymentState(previous,order);
      if(state==='paid'){const done=await client.rpc('settle_advertising_payment',{p_payment_id:previous.id,p_state:state});if(done.error)throw Error('De betaalstatus kon niet worden bijgewerkt.');return Response.json({error:'Deze aanvraag is betaald. Vernieuw de pagina.'},{status:409});}
      if(state==='refunded')return Response.json({error:'Deze aanvraag is terugbetaald. Neem contact op voor een nieuwe aanvraag.'},{status:409});
      if(state==='open'&&previous._links?.checkout?.href)return Response.json({checkoutUrl:previous._links.checkout.href});
      await client.from('advertising_requests').update({mollie_payment_id:null,checkout_key:crypto.randomUUID(),payment_status:'requested'}).eq('id',order.id).eq('mollie_payment_id',order.mollie_payment_id);
      const refreshed=await client.from('advertising_requests').select('*').eq('id',order.id).single();if(refreshed.error)throw Error('Aanvraag kon niet worden geladen.');order=refreshed.data;
    }
    const base=new URL(process.env.PUBLIC_SITE_URL??request.url).origin;
    if(!base.startsWith('https://'))throw Error('De publieke betaalomgeving is nog niet ingesteld.');
    const payment=await mollieRequest('payments',{method:'POST',headers:{'Idempotency-Key':order.checkout_key},body:JSON.stringify({amount:{currency:'EUR',value:(order.amount_cents/100).toFixed(2)},description:`Côte de Duras – ${order.placement} – ${order.months} maand(en)`,redirectUrl:base+'/mijn-vermelding?betaling=terug',webhookUrl:base+'/api/mollie/webhook',metadata:{requestId:order.id},billingAddress:{givenName:order.details.name,familyName:order.details.company||order.details.name,streetAndNumber:order.details.address,postalCode:order.details.postcode,city:order.details.city,country:order.details.country.toUpperCase()},billingEmail:order.details.email})});
    if(!payment.id||!payment._links?.checkout?.href||!/^https:\/\/([a-z0-9-]+\.)*mollie\.com\//i.test(payment._links.checkout.href))throw Error('Ongeldige betaalverwijzing.');
    const saved=await client.from('advertising_requests').update({mollie_payment_id:payment.id,payment_status:'open'}).eq('id',order.id).eq('checkout_key',order.checkout_key);
    if(saved.error)throw Error('De betaalreferentie kon niet worden opgeslagen.');
    return Response.json({checkoutUrl:payment._links.checkout.href});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Betaling niet beschikbaar.'},{status:502});}
}
