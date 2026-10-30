import {processMailOutbox} from '../../../../lib/mail-outbox';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;if(!secret)return Response.json({error:'Serverinstelling ontbreekt.'},{status:503});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({error:'Niet toegestaan.'},{status:401});
 try{return Response.json(await processMailOutbox(10));}catch{return Response.json({error:'De e-mailwachtrij kon niet worden verwerkt.'},{status:502});}
}
