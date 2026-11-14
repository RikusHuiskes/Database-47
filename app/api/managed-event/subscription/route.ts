import {paymentAccess} from '../../../../lib/advertiser-access';
import {managedAccess} from '../../../../lib/managed-events';
import {reconcileMonthlyPayment,processBillingMail} from '../../../../lib/recurring-server';
export const runtime='nodejs';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 try{
  const {eventId,contractId,action}=await request.json(),db=await managedAccess(request,eventId);if(!db)return Response.json({error:'Gebruik je persoonlijke beheerlink.'},{status:401});
  const found=await db.from('advertising_contracts').select('id,request_id,paid_until,status').eq('id',contractId).eq('event_id',eventId).single();if(found.error)throw Error('Abonnement niet gevonden.');if(!(await paymentAccess(request,eventId,found.data.request_id)))return Response.json({error:'Open je persoonlijke betaallink.'},{status:401});
  if(action==='cancel'){
   const cancelled=await db.rpc('cancel_monthly_contract',{p_contract_id:contractId});if(cancelled.error)throw Error('Opzeggen is niet gelukt. Probeer het opnieuw.');
   await processBillingMail(db,5).catch(()=>{});return Response.json({ok:true,paidUntil:found.data.paid_until});
  }
  if(action==='refresh'){
   const cycles=await db.from('advertising_billing_cycles').select('payment_id').eq('contract_id',contractId).not('payment_id','is',null).order('cycle_index',{ascending:false}).limit(1);
   if(cycles.error)throw Error('Betaalstatus niet beschikbaar.');if(cycles.data?.[0]?.payment_id)await reconcileMonthlyPayment(db,cycles.data[0].payment_id);
   return Response.json({ok:true});
  }
  throw Error('Onbekende handeling.');
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Abonnement niet beschikbaar.'},{status:400});}
}
