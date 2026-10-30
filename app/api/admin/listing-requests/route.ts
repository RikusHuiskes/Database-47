export const maxDuration=300;
import {after} from 'next/server';
import {processMailOutbox} from '../../../../lib/mail-outbox';
import {listingTriage} from '../../../../lib/listing-triage';
import {adminService} from '../../../../lib/admin-service';
import {managedToken,tokenHash} from '../../../../lib/managed-events';
export async function GET(request:Request) {
  const client=await adminService(request);
  if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
  const page=Math.max(1,Math.min(10000,Number(new URL(request.url).searchParams.get('page'))||1));
  const status=new URL(request.url).searchParams.get('status')??'pending';
  if(!['pending','approved','rejected','resolved','revoked','all'].includes(status))return Response.json({error:'Ongeldige selectie.'},{status:400});
  let query=client.from('listing_requests').select('*,events(title,source_url,website_url,contact_phone),listing_review_history(action,note,contact,created_at)',{count:'exact'});
  if(status!=='all')query=query.eq('status',status);
  const [result,claims,corrections]=await Promise.all([query.order('created_at',{ascending:status==='pending'}).range((page-1)*10,page*10-1),client.from('listing_requests').select('id',{count:'exact',head:true}).eq('status','pending').eq('kind','claim'),client.from('listing_requests').select('id',{count:'exact',head:true}).eq('status','pending').eq('kind','correction')]);
  if(result.error)return Response.json({error:'Aanvragen konden niet worden geladen.'},{status:502});
  const accessResult=result.data?.length?await client.from('event_owner_access').select('event_id').in('event_id',result.data.map(item=>item.event_id)):{data:[],error:null};
  if(accessResult.error)return Response.json({error:'Bestaande beheerrechten konden niet worden gecontroleerd.'},{status:502});
  const managedIds=new Set(accessResult.data?.map(row=>row.event_id));
  return Response.json({items:result.data?.map(item=>({...item,hasExistingAccess:managedIds.has(item.event_id),triage:listingTriage(item)})),total:result.count,queue:{claims:claims.count??0,corrections:corrections.count??0}},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
  const client=await adminService(request);
  if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
  try {
    const text=await request.text();if(text.length>8000)throw Error('De invoer is te groot.');
    const body=JSON.parse(text),token=managedToken();
    if(!['approved','reissued','rejected','resolved','revoked'].includes(body.action))throw Error('Kies een geldige actie.');
    const reviewer=await client.auth.getUser(request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')??'');
    if(!reviewer.data.user)return Response.json({error:'Log opnieuw in.'},{status:403});
    const {data,error}=await client.rpc('review_listing_request',{p_id:body.id,p_action:body.action,p_note:body.note??'',p_contact:body.contact??'',p_token_hash:tokenHash(token),p_reviewer:reviewer.data.user.id});
    if(error)throw Error(error.message);
    after(async()=>{await processMailOutbox().catch(()=>{});});
    return Response.json({ok:true,manageFragment:['approved','reissued'].includes(body.action)?`${data}:${token}`:undefined},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Verwerken mislukt.'},{status:400});}
}
