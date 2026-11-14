import {advertiserAccess} from '../../../../lib/advertiser-access';
import {processBillingMail,reconcileMonthlyPayment} from '../../../../lib/recurring-server';
export const runtime='nodejs';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 try{const {requestId,action}=await request.json(),db=await advertiserAccess(request,requestId);if(!db)return Response.json({error:'Open je persoonlijke betaallink.'},{status:401});
 const found=await db.from('advertising_contracts').select('id,paid_until').eq('request_id',requestId).single();if(found.error)throw Error('Abonnement niet gevonden.');
 if(action==='cancel'){const result=await db.rpc('cancel_monthly_contract',{p_contract_id:found.data.id});if(result.error)throw Error('Opzeggen mislukt.');await processBillingMail(db,5).catch(()=>{});}
 else if(action==='refresh'){const cycle=await db.from('advertising_billing_cycles').select('payment_id').eq('contract_id',found.data.id).not('payment_id','is',null).order('cycle_index',{ascending:false}).limit(1);if(cycle.error)throw Error('Betaalstatus niet beschikbaar.');if(cycle.data?.[0]?.payment_id)await reconcileMonthlyPayment(db,cycle.data[0].payment_id);}
 else throw Error('Onbekende handeling.');return Response.json({ok:true,paidUntil:found.data.paid_until});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Abonnement niet beschikbaar.'},{status:400});}
}
