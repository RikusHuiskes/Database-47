import {createServiceClient} from '../../../../lib/supabase-server';
import {mollieRequest,verifiedPaymentState} from '../../../../lib/mollie';
export const runtime='nodejs';
export async function POST(request:Request){
  if(!process.env.MOLLIE_API_KEY)return new Response(null,{status:503});
  try{
    const text=await request.text();if(text.length>500)return new Response(null,{status:400});
    const id=new URLSearchParams(text).get('id');if(!id||!/^tr_[A-Za-z0-9]+$/.test(id))return new Response(null,{status:400});
    const client=createServiceClient();if(!client)return new Response(null,{status:503});
    const {data:order,error}=await client.from('advertising_requests').select('id,amount_cents').eq('mollie_payment_id',id).maybeSingle();
    if(error||!order)return new Response(null,{status:503});
    // Never trust status/amount from the callback or the return URL.
    const payment=await mollieRequest('payments/'+encodeURIComponent(id));
    const state=verifiedPaymentState(payment,order);
    const result=await client.rpc('settle_advertising_payment',{p_payment_id:id,p_state:state});
    return new Response(null,{status:result.error?503:200});
  }catch{return new Response(null,{status:503});}
}
