import {createServiceClient} from '../../../lib/supabase-server';
import {managedToken,tokenHash} from '../../../lib/managed-events';
import {visitorEventInput} from '../../../lib/visitor-event-input';
import {validateAdvertiser} from '../../../lib/advertising';
export const runtime='nodejs';
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
  const service=createServiceClient();if(!service)return Response.json({error:'De database is tijdelijk niet beschikbaar.'},{status:503});
  try{
    const text=await request.text();if(text.length>24000)throw Error('De invoer is te groot.');
    const input=JSON.parse(text),event=visitorEventInput(input.event),category=input.categoryId||null;
    if(category&&!/^[a-f0-9-]{36}$/i.test(category))throw Error('Kies een geldige categorie.');
    let ad=null;
    if(event.promotion_type!=='none'){
      const checked=validateAdvertiser(String(event.promotion_type),input.advertiser);
      if(checked.quote.startDate<new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))throw Error('Kies een advertentiebegindatum vanaf vandaag.');
      ad={...checked.quote,details:checked.details};
    }
    const token=managedToken();
    const {data,error}=await service.rpc('submit_managed_event',{p_event:event,p_category_id:category,p_token_hash:tokenHash(token),p_ad:ad});
    if(error)throw Error('De vermelding kon niet worden opgeslagen. '+error.message);
    return Response.json({eventId:data,manageFragment:`${data}:${token}`,advertising:ad?{placement:event.promotion_type,amountCents:ad.amountCents,startDate:ad.startDate,endDate:ad.endDate,months:ad.months}:null},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Opslaan mislukt.'},{status:400});}
}
