import {adminService} from '../../../../lib/admin-service';
import {managedToken,tokenHash} from '../../../../lib/managed-events';
export async function GET(request:Request) {
  const client=await adminService(request);
  if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
  const page=Math.max(1,Math.min(10000,Number(new URL(request.url).searchParams.get('page'))||1));
  const result=await client.from('listing_requests').select('*,events(title,source_url,website_url,contact_phone),listing_review_history(action,note,contact,created_at)',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*10,page*10-1);
  if(result.error)return Response.json({error:'Aanvragen konden niet worden geladen.'},{status:502});
  return Response.json({items:result.data,total:result.count},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
  const client=await adminService(request);
  if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
  try {
    const text=await request.text();if(text.length>8000)throw Error('De invoer is te groot.');
    const body=JSON.parse(text),token=managedToken();
    if(!['approved','rejected','resolved','revoked'].includes(body.action))throw Error('Kies een geldige actie.');
    const reviewer=await client.auth.getUser(request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')??'');
    if(!reviewer.data.user)return Response.json({error:'Log opnieuw in.'},{status:403});
    const {data,error}=await client.rpc('review_listing_request',{p_id:body.id,p_action:body.action,p_note:body.note??'',p_contact:body.contact??'',p_token_hash:tokenHash(token),p_reviewer:reviewer.data.user.id});
    if(error)throw Error(error.message);
    return Response.json({ok:true,manageFragment:body.action==='approved'?`${data}:${token}`:undefined},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Verwerken mislukt.'},{status:400});}
}
