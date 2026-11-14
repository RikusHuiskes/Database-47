import {after} from 'next/server';
import {processBillingMail} from '../../../../../lib/recurring-server';
import {processAdvertisingInvoiceMailOutbox} from '../../../../../lib/advertising-invoices';
import {createServiceClient} from '../../../../../lib/supabase-server';
import {reconcileMonthlyPayment} from '../../../../../lib/recurring-server';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request){
 try{
  const text=await request.text();if(text.length>500)return new Response(null,{status:400});
  const id=new URLSearchParams(text).get('id');if(!id||!/^tr_[A-Za-z0-9]+$/.test(id))return new Response(null,{status:400});
  const db=createServiceClient();if(!db||!process.env.MOLLIE_API_KEY)return new Response(null,{status:503});
  await reconcileMonthlyPayment(db,id);
  after(async()=>{await processBillingMail(db,10).catch(()=>{});await processAdvertisingInvoiceMailOutbox(10).catch(()=>{});});
  return new Response(null,{status:200});
 }catch{return new Response(null,{status:503});}
}
