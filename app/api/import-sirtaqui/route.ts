import {NextResponse} from "next/server";
import {fetchSirtaquiEvents} from "../../../lib/import-sources/sirtaqui";
export const runtime="nodejs";
export const maxDuration=60;
export async function GET(request:Request){
  const department=new URL(request.url).searchParams.get("department");
  if(department && !["24","33","47"].includes(department)) return NextResponse.json({error:"Ongeldig departement."},{status:400});
  try{return NextResponse.json({events:await fetchSirtaquiEvents(new Date(),department?[department]:undefined),sourceName:"SIRTAQUI — officiële streekagenda’s"});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"De streekagenda’s konden niet worden opgehaald."},{status:502});}
}
