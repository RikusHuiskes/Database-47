import {createClient} from "@supabase/supabase-js";
import {NextResponse} from "next/server";
import {fetchSirtaquiEvents} from "../../../../lib/import-sources/sirtaqui";
import {createServiceClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
export const maxDuration=300;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret) return NextResponse.json({error:"CRON_SECRET ontbreekt."},{status:503});
  if(request.headers.get("authorization")!==`Bearer ${secret}`) return NextResponse.json({error:"Niet toegestaan."},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key) return NextResponse.json({error:"De Supabase-serverinstelling ontbreekt."},{status:503});
  let inserted=0,skipped=0,checked=0;
  try{
    const supabase=createServiceClient(),events=await fetchSirtaquiEvents();
    for(let offset=0;offset<events.length;offset+=100){
      const batch=events.slice(offset,offset+100);
      const {data,error}=await supabase.rpc("import_pending_source_events",{p_events:batch});
      if(error) throw new Error(error.message);
      inserted+=Number(data?.inserted??0);skipped+=Number(data?.skipped??0);checked+=batch.length;
    }
    return NextResponse.json({ok:true,checked,inserted,skipped});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Import mislukt.",checked,inserted,skipped},{status:502});}
}
