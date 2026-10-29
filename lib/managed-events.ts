import {createHash,randomBytes} from 'node:crypto';
import {createServiceClient} from './supabase-server.ts';
export const managedToken=()=>randomBytes(32).toString('base64url');
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function managedAccess(request:Request,eventId:string){
  const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if(!token||!/^[a-f0-9-]{36}$/i.test(eventId))return null;
  const client=createServiceClient();if(!client)return null;
  const {data,error}=await client.from('event_owner_access').select('event_id').eq('event_id',eventId).eq('token_hash',tokenHash(token)).maybeSingle();
  return error||!data?null:client;
}
