import {adminService} from '../../../../lib/admin-service';
export async function GET(request:Request){
 const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
 const id=new URL(request.url).searchParams.get('eventId');
 if(!id||!/^[a-f0-9-]{36}$/i.test(id))return Response.json({error:'Ongeldige vermelding.'},{status:400});
 const {data,error}=await client.from('listing_change_history').select('created_at,before_data,after_data').eq('event_id',id).order('created_at',{ascending:false}).limit(25);
 if(error)return Response.json({error:'Geschiedenis kon niet worden geladen.'},{status:502});
 return Response.json({items:data},{headers:{'Cache-Control':'no-store'}});
}
