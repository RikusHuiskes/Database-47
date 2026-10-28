import {createClient} from '@supabase/supabase-js';
import {createServiceClient} from '../../../lib/supabase-server';
import snapshot from '../../../lib/data/directory-entries.json';

export const runtime='nodejs';
export async function POST(request:Request) {
  const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return Response.json({error:'Log in als beheerder.'},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return Response.json({error:'Databaseverbinding ontbreekt.'},{status:503});
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const auth=await client.rpc('is_admin');
  if(auth.error||auth.data!==true)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
  let offset:number;
  try{offset=(await request.json()).offset;if(!Number.isSafeInteger(offset)||offset<0||offset%100!==0)throw Error();}
  catch{return Response.json({error:'Ongeldige importbatch.'},{status:400});}
  const service=createServiceClient();
  if(!service)return Response.json({error:'Serververbinding ontbreekt.'},{status:503});
  const result=await service.rpc('import_directory_entries',{p_entries:snapshot.entries.slice(offset,offset+100)});
  if(result.error)return Response.json({error:result.error.message},{status:502});
  return Response.json({...result.data,total:snapshot.entries.length,updatedAt:snapshot.updatedAt});
}
