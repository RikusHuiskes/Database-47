import {ADVERTISING_SELLER} from '../../../lib/mollie';
import {MONTHLY_PRICES} from '../../../lib/advertising';
import {createServiceClient} from '../../../lib/supabase-server';
export async function GET(){
 const client=createServiceClient();
 const probe=client?await client.from('advertising_contracts').select('id').limit(0):null;
 const databaseReady=Boolean(probe&&!probe.error);
 return Response.json({configured:Boolean(process.env.MOLLIE_API_KEY)&&databaseReady,databaseReady,
  ...(process.env.VERCEL_ENV==='preview'?{testDatabaseProject:process.env.NEXT_PUBLIC_SUPABASE_URL?new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]:null,databaseError:probe?.error?.code??null}:{}),
  monthlyPrices:MONTHLY_PRICES,seller:ADVERTISING_SELLER},{headers:{'Cache-Control':'no-store'}});
}
