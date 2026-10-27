import {NextResponse} from "next/server";
import {fetchRegionalOfficialEventsWithReport} from "../../../lib/import-sources/regional-official-agendas";
export const runtime="nodejs";
export const maxDuration=300;
export async function GET(request:Request){
  const source=new URL(request.url).searchParams.get("source")||undefined;
  if(source&&!['marmande','miramont','pineuilh','sainte-foy'].includes(source))return NextResponse.json({error:"Onbekende agendabron."},{status:400});
  try{return NextResponse.json(await fetchRegionalOfficialEventsWithReport(new Date(),source));}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"De gemeentelijke agenda kon niet worden opgehaald."},{status:502});}
}
