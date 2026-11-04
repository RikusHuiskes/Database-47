import {createServiceClient} from '../../../lib/supabase-server';
import {managedToken,tokenHash} from '../../../lib/managed-events';
import {visitorEventInput} from '../../../lib/visitor-event-input';
import {validateAdvertiser,advertisingSelectionQuote} from '../../../lib/advertising';
export const runtime='nodejs';
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
  const service=createServiceClient();if(!service)return Response.json({error:'De database is tijdelijk niet beschikbaar.'},{status:503});
  try{
    const text=await request.text();if(text.length>24000)throw Error('De invoer is te groot.');
    const input=JSON.parse(text),event=visitorEventInput(input.event),category=input.categoryId||null;
    if(category&&!/^[a-f0-9-]{36}$/i.test(category))throw Error('Kies een geldige categorie.');
    let ad=null;const combined=input.placements!==undefined;
    const placements=combined?input.placements:event.promotion_type==='none'?[]:[event.promotion_type];
    if(!Array.isArray(placements))throw Error('Kies geldige advertentievormen.');
    if(combined)event.promotion_type=placements[0]??'none';
    if(placements.length){
      const checked=validateAdvertiser(String(event.promotion_type),input.advertiser);
      const quote=advertisingSelectionQuote(placements,checked.details);
      if(quote.placements.includes('category')&&!category)throw Error('Kies een categorie voor de categorieadvertentie.');
      if(checked.quote.startDate<new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))throw Error('Kies een advertentiebegindatum vanaf vandaag.');
      ad={...quote,details:{...checked.details,placements:quote.placements}};
    }
    const token=managedToken();
    const {data,error}=await service.rpc(combined&&ad?'submit_managed_event_selection':'submit_managed_event',{p_event:event,p_category_id:category,p_token_hash:tokenHash(token),p_ad:ad});
    if(error)throw Error('De vermelding kon niet worden opgeslagen. '+error.message);
    if(ad&&process.env.MOLLIE_API_KEY?.startsWith('test_')){
      const marked=await service.from('advertising_requests').update({is_test_mode:true}).eq('event_id',data).eq('payment_status','requested');
      if(marked.error)throw Error('De aanvraag is aangemaakt, maar de testmarkering kon niet worden opgeslagen. Neem contact op met de beheerder voordat je betaalt.');
    }
    return Response.json({eventId:data,manageFragment:`${data}:${token}`,advertising:ad?{placement:event.promotion_type,placements:ad.placements,amountCents:ad.amountCents,startDate:ad.startDate,endDate:ad.endDate,months:ad.months}:null},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Opslaan mislukt.'},{status:400});}
}
