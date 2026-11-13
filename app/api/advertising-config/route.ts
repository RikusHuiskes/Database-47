import {mollieRequest,ADVERTISING_SELLER} from '../../../lib/mollie';
import {MONTHLY_PRICES} from '../../../lib/advertising';
import {createServiceClient} from '../../../lib/supabase-server';
export async function GET(request?:Request){
 let providerReadiness:Record<string,unknown>|undefined;
 if(process.env.VERCEL_ENV==='preview'&&request&&new URL(request.url).searchParams.get('readiness')==='1'){
  try{const [profile,first,recurring]=await Promise.all([mollieRequest('profiles/me'),mollieRequest('methods?sequenceType=first&amount%5Bcurrency%5D=EUR&amount%5Bvalue%5D=15.00'),mollieRequest('methods?sequenceType=recurring')]);
   providerReadiness={profileId:profile.id,profileName:profile.name,profileStatus:profile.status,firstMethods:(first._embedded?.methods??[]).map((m:{id:string})=>m.id),recurringMethods:(recurring._embedded?.methods??[]).map((m:{id:string})=>m.id)};
  }catch{providerReadiness={error:'Provider readiness could not be checked.'};}
 }
 const client=createServiceClient();
 const probe=client?await client.from('advertising_contracts').select('id').limit(0):null;
 const databaseReady=Boolean(probe&&!probe.error);
 return Response.json({configured:Boolean(process.env.MOLLIE_API_KEY)&&databaseReady,databaseReady,
  ...(process.env.VERCEL_ENV==='preview'?{testDatabaseProject:process.env.NEXT_PUBLIC_SUPABASE_URL?new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]:null,databaseError:probe?.error?.code??null}:{}),
  ...(providerReadiness?{providerReadiness}:{}),monthlyPrices:MONTHLY_PRICES,seller:ADVERTISING_SELLER},{headers:{'Cache-Control':'no-store'}});
}
