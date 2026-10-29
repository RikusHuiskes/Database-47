import {adminService} from '../../../../lib/admin-service';
export async function GET(request:Request){
  const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
  const raw=Number(new URL(request.url).searchParams.get('page')??1),page=Number.isSafeInteger(raw)&&raw>0?raw:1;
  const result=await client.from('advertising_requests').select('id,event_id,placement,details,starts_on,ends_on,months,amount_cents,payment_status,events(title)',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*10,page*10-1);
  if(result.error)return Response.json({error:'Aanvragen konden niet worden geladen.'},{status:502});
  return Response.json({items:result.data,total:result.count,page},{headers:{'Cache-Control':'no-store'}});
}
