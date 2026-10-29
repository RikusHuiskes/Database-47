import {createServiceClient} from '../../../../lib/supabase-server';
import {fetchDirectoryEntries} from '../../../../lib/import-sources/directory';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;if(!secret)return Response.json({error:'CRON_SECRET ontbreekt.'},{status:503});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({error:'Niet toegestaan.'},{status:401});
 const service=createServiceClient();if(!service)return Response.json({error:'Serververbinding ontbreekt.'},{status:503});
 let checked=0,inserted=0,skipped=0;
 try{const fetched=await fetchDirectoryEntries();for(let offset=0;offset<fetched.entries.length;offset+=100){const batch=fetched.entries.slice(offset,offset+100);const result=await service.rpc('import_directory_entries',{p_entries:batch});if(result.error)throw Error(result.error.message);checked+=batch.length;inserted+=Number(result.data?.inserted??0);skipped+=Number(result.data?.skipped??0);}return Response.json({ok:true,checked,inserted,skipped,sources:fetched.sources});}
 catch(error){return Response.json({error:error instanceof Error?error.message:'Import mislukt.',checked,inserted,skipped},{status:502});}
}
