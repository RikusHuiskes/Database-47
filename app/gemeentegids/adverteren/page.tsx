import {createServiceClient} from '../../../lib/supabase-server';
import type {Metadata} from 'next';
import AdvertisingPreview from './AdvertisingPreview';
import {canonicalMunicipalBusiness} from '../../../lib/municipal-business';
import {municipalCatalog} from '../../../lib/municipal-catalog';
import {MUNICIPAL_BUSINESS_LABELS} from '../../../lib/municipal-shops';
export const metadata:Metadata={title:'Adverteren in de gemeentegids | Côte de Duras',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const text=(key:string,fallback:string)=>typeof params[key]==='string'?params[key].trim().slice(0,250)||fallback:fallback;
 const city=text('city','Duras'),key=text('serviceId','');
 const defaultEntry=municipalCatalog('Duras',44.6764,.1837,'estate_agent','47086').services.find(entry=>entry.inSelectedMunicipality);
 const found=canonicalMunicipalBusiness(key||defaultEntry?.id||'',key?city:'Duras');
 if(!found)return <main className="owner-management"><h1>Kies je bedrijfsvermelding</h1><p>Open je bedrijf in de gemeentegids om beheer aan te vragen of advertenties te kiezen.</p><a href="/#gemeenten">Naar de gemeentegids →</a></main>;
 const {entry:source,area}=found;let entry={...source};const client=createServiceClient();
 if(client){const result=await client.from('events').select('title,address,contact_phone,municipal_email,municipal_hours,website_url').eq('municipal_key',source.id).eq('status','approved').eq('verified',true).maybeSingle();if(!result.error&&result.data)entry={...entry,name:result.data.title,address:result.data.address||undefined,phone:result.data.contact_phone||undefined,email:result.data.municipal_email||undefined,openingHours:result.data.municipal_hours||undefined,website:result.data.website_url||undefined};}
 return <AdvertisingPreview serviceId={entry.id} name={entry.name} city={area.name} category={MUNICIPAL_BUSINESS_LABELS[entry.type]||entry.type} address={entry.address||''} website={entry.website||''} phone={entry.phone||''} email={entry.email||''} hours={entry.openingHours||''}/>;
}
