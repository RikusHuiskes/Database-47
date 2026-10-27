import {NextResponse} from "next/server";
import {fetchOpenAgendaEvents} from "../../../lib/openagenda";
import catalog from "../../../lib/data/area-catalog.json";
export const runtime="nodejs";
export const maxDuration=300;
export async function GET(){
  try{return NextResponse.json({...await fetchOpenAgendaEvents(catalog.areas),sourceName:"OpenAgenda — nationale evenementenkalender"});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"De nationale agenda is niet bereikbaar."},{status:502});}
}
