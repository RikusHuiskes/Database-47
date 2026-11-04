import {managedAccess} from '../../../../lib/managed-events';
import {mollieRequest,verifiedPaymentState} from '../../../../lib/mollie';
import {advertisingOrderTypes,ADVERTISING_LABELS} from '../../../../lib/advertising';
export const runtime='nodejs';
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
  try{
    const {eventId,requestId}=await request.json(),client=await managedAccess(request,eventId);
    if(!client)return Response.json({error:'Gebruik je persoonlijke beheerlink.'},{status:401});
    if(!process.env.MOLLIE_API_KEY)return Response.json({error:'Online betalen is nog niet geactiveerd. Je aanvraag blijft bewaard.'},{status:503});
    let orderQuery=client.from('advertising_requests').select('*').eq('event_id',eventId).order('created_at',{ascending:false}).limit(1);
    if(requestId)orderQuery=orderQuery.eq('id',requestId);
    const {data:initialOrder,error}=await orderQuery.maybeSingle();let order=initialOrder;
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
    const context=await client.from('events').select('municipal_key,city').eq('id',eventId).maybeSingle();
    if(context.error||!context.data)throw Error('De vermelding kon niet worden gecontroleerd.');
    const labels=context.data.municipal_key?{...ADVERTISING_LABELS,category:'Rubriekpartner',homepage:'Gemeentepartner'}:ADVERTISING_LABELS;
    const placements=advertisingOrderTypes(order);
    if(!placements.length)throw Error('Ongeldige advertentieaanvraag.');
    for(const placement of placements){
      const capacity=await client.rpc('assert_advertising_capacity',{p_event_id:eventId,p_placement:placement,p_starts_on:order.starts_on,p_ends_on:order.ends_on});
      if(capacity.error)return Response.json({error:capacity.error.message},{status:409});
    }
    // Owner access is stored in the originating tab. A canonical webhook URL
    // must not move the payment return to another domain and lose that access.
    const base=new URL(process.env.VERCEL_ENV==='preview'?request.url:(process.env.PUBLIC_SITE_URL??request.url)).origin;
    const returnBase=new URL(request.url).origin;
    if(!base.startsWith('https://')||!returnBase.startsWith('https://'))throw Error('De publieke betaalomgeving is nog niet ingesteld.');
    const redirectUrl=new URL('/mijn-vermelding',returnBase);
    redirectUrl.searchParams.set('betaling','terug');
    redirectUrl.searchParams.set('aanvraag',order.id);
    const payment=await mollieRequest('payments',{method:'POST',headers:{'Idempotency-Key':order.checkout_key},body:JSON.stringify({amount:{currency:'EUR',value:(order.amount_cents/100).toFixed(2)},description:`Côte de Duras – ${placements.map(type=>labels[type]).join(' + ')} – ${order.months} maand(en)`,redirectUrl:redirectUrl.toString(),webhookUrl:base+'/api/mollie/webhook',metadata:{requestId:order.id},billingAddress:{givenName:order.details.name,familyName:order.details.company||order.details.name,streetAndNumber:order.details.address,postalCode:order.details.postcode,city:order.details.city,country:order.details.country.toUpperCase()},billingEmail:order.details.email})});
    if(!payment.id||!payment._links?.checkout?.href||!/^https:\/\/([a-z0-9-]+\.)*mollie\.com\//i.test(payment._links.checkout.href))throw Error('Ongeldige betaalverwijzing.');
    const saved=await client.from('advertising_requests').update({mollie_payment_id:payment.id,payment_status:'open'}).eq('id',order.id).eq('checkout_key',order.checkout_key);
    if(saved.error)throw Error('De betaalreferentie kon niet worden opgeslagen.');
    return Response.json({checkoutUrl:payment._links.checkout.href});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Betaling niet beschikbaar.'},{status:502});}
}
