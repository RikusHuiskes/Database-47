import {createServiceClient} from './supabase-server';
import {managedAccess,tokenHash} from './managed-events';
export function isAdvertiserRoute(request:Request){return new URL(request.url).pathname.startsWith('/api/advertiser/');}
export async function advertiserAccess(request:Request,requestId:unknown){
 if(typeof requestId!=='string'||! /^[a-f0-9-]{36}$/i.test(requestId))return null;
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];if(!token)return null;
 const db=createServiceClient();if(!db)return null;
 const found=await db.from('advertiser_access').select('request_id').eq('request_id',requestId).eq('token_hash',tokenHash(token)).maybeSingle();
 return found.error||!found.data?null:db;
}
export async function paymentAccess(request:Request,eventId:string,requestId?:string){
 if(!isAdvertiserRoute(request)){
  const db=await managedAccess(request,eventId);if(!db||!requestId)return db;
  const direct=await db.from('advertiser_access').select('request_id').eq('request_id',requestId).maybeSingle();if(direct.error||direct.data)return null;
  const cycle=await db.from('advertising_billing_cycles').select('advertising_contracts(request_id)').eq('request_id',requestId).maybeSingle();if(cycle.error)return null;
  if(cycle.data){const contracts=cycle.data.advertising_contracts;const parent=Array.isArray(contracts)?contracts[0]:contracts;const root=await db.from('advertiser_access').select('request_id').eq('request_id',parent?.request_id).maybeSingle();if(root.error||root.data)return null;}
  return db;
 }
 const db=await advertiserAccess(request,requestId);if(!db)return null;
 const order=await db.from('advertising_requests').select('id').eq('id',requestId).eq('event_id',eventId).maybeSingle();
 return order.error||!order.data?null:db;
}
