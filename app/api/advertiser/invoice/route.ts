import {advertiserAccess} from '../../../../lib/advertiser-access';
import {advertisingInvoicePdf} from '../../../../lib/advertising-invoices';
export const runtime='nodejs';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});
 try{const {requestId,invoiceId}=await request.json(),db=await advertiserAccess(request,requestId);if(!db)return new Response(null,{status:401});
 const contract=await db.from('advertising_contracts').select('id').eq('request_id',requestId).maybeSingle();if(contract.error)return new Response(null,{status:503});
 const cycles=contract.data?await db.from('advertising_billing_cycles').select('request_id').eq('contract_id',contract.data.id):null;if(cycles?.error)return new Response(null,{status:503});
 const found=await db.from('advertising_invoices').select('snapshot,invoice_number').eq('id',invoiceId).in('request_id',cycles?.data?.map(x=>x.request_id)??[requestId]).maybeSingle();if(found.error||!found.data)return new Response(null,{status:404});
 return new Response(new Uint8Array(advertisingInvoicePdf(found.data.snapshot)),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Factuur.pdf"','Cache-Control':'no-store'}});
 }catch{return new Response(null,{status:400});}
}
