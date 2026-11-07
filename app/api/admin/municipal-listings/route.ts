import {municipalAdminCatalog,municipalAdminResults,type MunicipalAdminItem} from '../../../../lib/municipal-admin-catalog';
import {canonicalMunicipalBusiness} from '../../../../lib/municipal-business';
import {COMMERCIAL_SERVICE_TYPES} from '../../../../lib/municipal-shops';
import {adminService} from '../../../../lib/admin-service';
import {scheduleListingMail} from '../../../../lib/schedule-listing-mail';
const fields='id,title,city,address,municipal_key,municipal_code,municipal_type,municipal_email,municipal_hours,contact_phone,website_url,description,promotion_status,image_url,status,verified';
export async function GET(request:Request){
 const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
 const page=Math.max(1,Math.floor(Number(new URL(request.url).searchParams.get('page'))||1));
 const status=new URL(request.url).searchParams.get('status')||'';if(status&&!['pending','approved','rejected'].includes(status))return Response.json({error:'Ongeldig filter.'},{status:400});
 const params=new URL(request.url).searchParams,code=params.get('code')||'',type=params.get('type')||'';if(code&&!/^[0-9]{5}$/.test(code)||type&&!COMMERCIAL_SERVICE_TYPES.includes(type))return Response.json({error:'Ongeldig filter.'},{status:400});
 const registered:MunicipalAdminItem[]=[];
 for(let offset=0;;offset+=1000){
  const result=await client.from('events').select(fields).not('municipal_key','is',null).order('id').range(offset,offset+999);
  if(result.error)return Response.json({error:'Bedrijven konden niet worden geladen.'},{status:502});
  registered.push(...result.data as MunicipalAdminItem[]);if(result.data.length<1000)break;
 }
 return Response.json(municipalAdminResults(municipalAdminCatalog(),registered,code,type,page,status),{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
 try{const raw=await request.text();if(raw.length>16000)throw Error('De invoer is te groot.');const body=JSON.parse(raw);if(typeof body.id!=='string'||!(/^[a-f0-9-]{36}$/i.test(body.id)||body.id.startsWith('catalog:')))throw Error('Kies een bedrijf.');
 if(body.action==='review'){
  if(body.id.startsWith('catalog:')||!['approved','rejected'].includes(body.decision))throw Error('Kies goedkeuren of afwijzen.');
  const result=await client.from('events').update({status:body.decision,verified:body.decision==='approved',updated_at:new Date().toISOString()}).eq('id',body.id).not('municipal_key','is',null).eq('status','pending').select('id').maybeSingle();
  if(result.error)throw Error('De beslissing kon niet worden opgeslagen.');
  if(!result.data)return Response.json({error:'Deze aanmelding is al behandeld. Vernieuw de lijst.'},{status:409});
  if(body.decision==='approved')scheduleListingMail(body.id);
  return Response.json({ok:true,id:body.id});
 }
 const patch:Record<string,string|null>={};for(const field of ['title','address','contact_phone','municipal_email','municipal_hours','website_url','description','image_url']){if(typeof body[field]!=='string')continue;const value=body[field].trim();if(value.length>(field==='description'?12000:1000))throw Error('Een veld is te lang.');patch[field]=value||null;}
 if(!patch.title)throw Error('Vul de bedrijfsnaam in.');if(patch.municipal_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.municipal_email))throw Error('Controleer het e-mailadres.');if(patch.website_url&&!/^https?:\/\//i.test(patch.website_url))throw Error('Vul een volledig websiteadres in.');
 if(patch.image_url&&!/^https?:\/\//i.test(patch.image_url))throw Error('Vul een volledig foto-adres in.');
 let id=body.id;
 if(id.startsWith('catalog:')){
  const found=canonicalMunicipalBusiness(id.slice(8),typeof body.city==='string'?body.city:'');
  if(!found)throw Error('Kies een bedrijf.');
  const {entry,area}=found;
  const registration=await client.rpc('register_municipal_listing',{p_listing:{key:entry.id,type:entry.type,code:area.code_insee,title:entry.name,city:area.name,address:entry.address,website:entry.website,source_url:entry.sourceUrl,phone:entry.phone,email:entry.email,hours:entry.openingHours,latitude:entry.latitude,longitude:entry.longitude}});
  if(registration.error)throw Error('Opslaan mislukt.');id=registration.data;
 }
 const result=await client.from('events').update({...patch,updated_at:new Date().toISOString()}).eq('id',id).not('municipal_key','is',null).select('id').single();if(result.error)throw Error('Opslaan mislukt.');return Response.json({ok:true,id});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Opslaan mislukt.'},{status:400});}
}
