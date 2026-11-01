import {createServiceClient} from '../../../lib/supabase-server';
import {canonicalMunicipalBusiness} from '../../../lib/municipal-business';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 try{
 const raw=await request.text();if(raw.length>1500)throw Error('De aanvraag is te groot.');const body=JSON.parse(raw);
 if(typeof body.serviceId!=='string'||body.serviceId.length>250||typeof body.city!=='string'||body.city.length>150)throw Error('Kies eerst je bedrijf in de gemeentegids.');
 const found=canonicalMunicipalBusiness(body.serviceId,body.city);if(!found)throw Error('Deze bedrijfsvermelding of vestigingsgemeente kon niet worden bevestigd. Geef eerst een correctie door aan de beheerder.');
 const client=createServiceClient();if(!client)return Response.json({error:'Beheer aanvragen is tijdelijk niet beschikbaar.'},{status:503});
 const {entry,area}=found;
 const result=await client.rpc('register_municipal_listing',{p_listing:{key:entry.id,type:entry.type,code:area.code_insee,title:entry.name,city:area.name,address:entry.address,website:entry.website,source_url:entry.sourceUrl,phone:entry.phone,email:entry.email,hours:entry.openingHours,latitude:entry.latitude,longitude:entry.longitude}});
 if(result.error)throw Error('De gemeentegidsvermelding kon niet worden klaargezet. Probeer het opnieuw.');
 return Response.json({eventId:result.data},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Aanvragen mislukt.'},{status:400});}
}
