import {createClient} from '@supabase/supabase-js';
import {createServiceClient} from './supabase-server';
export async function adminService(request:Request){
  const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!token||!url||!key)return null;
  const user=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const result=await user.rpc('is_admin');
  return !result.error&&result.data===true?createServiceClient():null;
}
