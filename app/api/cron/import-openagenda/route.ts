import {NextResponse} from "next/server";
import {createServiceClient} from "../../../../lib/supabase-server";
import {fetchOpenAgendaEvents} from "../../../../lib/openagenda";
import catalog from "../../../../lib/data/area-catalog.json";
export const runtime="nodejs";
export const maxDuration=300;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret)return NextResponse.json({error:"CRON_SECRET ontbreekt."},{status:503});
  if(request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Niet toegestaan."},{status:401});
  const supabase=createServiceClient();
  if(!supabase)return NextResponse.json({error:"De Supabase-serverinstelling ontbreekt."},{status:503});
  let inserted=0,skipped=0,checked=0;
  try{
    const fetched=await fetchOpenAgendaEvents(catalog.areas);
    for(let offset=0;offset<fetched.events.length;offset+=100){
      const batch=fetched.events.slice(offset,offset+100);
      const {data,error}=await supabase.rpc("import_pending_source_events",{p_events:batch});
      if(error)throw new Error(error.message);
      inserted+=Number(data?.inserted??0);skipped+=Number(data?.skipped??0);checked+=batch.length;
    }
    return NextResponse.json({ok:true,checked,inserted,skipped,recordsChecked:fetched.recordsChecked});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Import mislukt.",checked,inserted,skipped},{status:502});}
}
