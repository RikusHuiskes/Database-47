import {after} from 'next/server';
import {processBillingMail} from '../../../../lib/recurring-server';
import {processAdvertisingInvoiceMailOutbox} from '../../../../lib/advertising-invoices';
import {reconcileMonthlyPayment} from '../../../../lib/recurring-server';
import {paymentAccess,isAdvertiserRoute} from '../../../../lib/advertiser-access';
import {mollieRequest,verifiedPaymentState} from '../../../../lib/mollie';
export const runtime='nodejs';

// A return from checkout is not proof of payment. Reconcile against Mollie's
// authenticated API, using only the payment reference stored with this owner.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 try{
  const {eventId,requestId}=await request.json();
  const client=await paymentAccess(request,eventId,requestId);
  if(!client)return Response.json({error:'Gebruik je persoonlijke beheerlink.'},{status:401});
  if(!process.env.MOLLIE_API_KEY)return Response.json({error:'Online betalen is nog niet geactiveerd.'},{status:503});
  let orderQuery=client.from('advertising_requests').select('id,amount_cents,mollie_payment_id,payment_status').eq('event_id',eventId).order('created_at',{ascending:false}).limit(1);
    if(requestId)orderQuery=orderQuery.eq('id',requestId);
    const {data:initialOrder,error}=await orderQuery.maybeSingle();let order=initialOrder;
  if(error)throw Error('De advertentieaanvraag kon niet worden geladen.');
  if(!order)return Response.json({error:'Advertentieaanvraag niet gevonden.'},{status:404});
    if(!(await paymentAccess(request,eventId,order.id)))return Response.json({error:'Open je persoonlijke betaallink.'},{status:401});
  if(!order.mollie_payment_id)return Response.json({paymentStatus:order.payment_status},{headers:{'Cache-Control':'no-store'}});
  const monthly=await client.from('advertising_billing_cycles').select('id').eq('request_id',order.id).maybeSingle();
  if(monthly.error)throw Error('Abonnementscontrole is niet beschikbaar.');
  if(monthly.data){const result=await reconcileMonthlyPayment(client,order.mollie_payment_id);after(async()=>{await processBillingMail(client,10).catch(()=>{});await processAdvertisingInvoiceMailOutbox(10).catch(()=>{});});return Response.json(result,{headers:{'Cache-Control':'no-store'}});}
  const payment=await mollieRequest('payments/'+encodeURIComponent(order.mollie_payment_id));
  const state=verifiedPaymentState(payment,order);
  const result=await client.rpc('settle_advertising_payment',{p_payment_id:order.mollie_payment_id,p_state:state});
  if(result.error)throw Error('De betaalstatus kon niet worden bijgewerkt.');
  return Response.json({paymentStatus:state},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'De betaalstatus kon niet worden gecontroleerd. Probeer het later opnieuw.'},{status:502});}
}
