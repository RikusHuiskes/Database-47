import {COMMERCIAL_SERVICE_TYPES} from '../../../../lib/municipal-shops';
import {adminService} from '../../../../lib/admin-service';
const fields='id,title,city,address,municipal_key,municipal_code,municipal_type,municipal_email,municipal_hours,contact_phone,website_url,description,promotion_status';
export async function GET(request:Request){
 const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
 const page=Math.max(1,Math.floor(Number(new URL(request.url).searchParams.get('page'))||1));
 const params=new URL(request.url).searchParams,code=params.get('code')||'',type=params.get('type')||'';if(code&&!/^[0-9]{5}$/.test(code)||type&&!COMMERCIAL_SERVICE_TYPES.includes(type))return Response.json({error:'Ongeldig filter.'},{status:400});
 let query=client.from('events').select(fields,{count:'exact'}).not('municipal_key','is',null);if(code)query=query.eq('municipal_code',code);if(type)query=query.eq('municipal_type',type);
 const result=await query.order('city').order('title').range((page-1)*25,page*25-1);
 if(result.error)return Response.json({error:'Bedrijven konden niet worden geladen.'},{status:502});return Response.json({items:result.data,total:result.count},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
 try{const raw=await request.text();if(raw.length>16000)throw Error('De invoer is te groot.');const body=JSON.parse(raw);if(!/^[a-f0-9-]{36}$/i.test(body.id))throw Error('Kies een bedrijf.');const patch:Record<string,string|null>={};for(const field of ['title','address','contact_phone','municipal_email','municipal_hours','website_url','description']){if(typeof body[field]!=='string')continue;const value=body[field].trim();if(value.length>(field==='description'?12000:1000))throw Error('Een veld is te lang.');patch[field]=value||null;}
 if(!patch.title)throw Error('Vul de bedrijfsnaam in.');if(patch.municipal_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.municipal_email))throw Error('Controleer het e-mailadres.');if(patch.website_url&&!/^https?:\/\//i.test(patch.website_url))throw Error('Vul een volledig websiteadres in.');
 const result=await client.from('events').update({...patch,updated_at:new Date().toISOString()}).eq('id',body.id).not('municipal_key','is',null).select('id').single();if(result.error)throw Error('Opslaan mislukt.');return Response.json({ok:true});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Opslaan mislukt.'},{status:400});}
}
