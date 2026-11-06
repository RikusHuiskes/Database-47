import {localizeMetadata} from '../../i18n/server';

import {T, A} from '../../i18n/Language';
import {createServiceClient} from '../../../lib/supabase-server';
import type {Metadata} from 'next';
import AdvertisingPreview from './AdvertisingPreview';
import {resolveMunicipalBusiness} from '../../../lib/municipal-advertising-server';
import {MUNICIPAL_BUSINESS_LABELS} from '../../../lib/municipal-shops';
const sourceMetadata:Metadata={title:'Adverteren in de gemeentegids | Côte de Duras',robots:{index:false,follow:false}};
export async function generateMetadata(){return localizeMetadata(sourceMetadata);}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const text=(key:string,fallback:string)=>typeof params[key]==='string'?params[key].trim().slice(0,250)||fallback:fallback;
 const city=text('city','Duras'),key=text('serviceId','');
 if(!key){
  const requestedCategory=text('category','Fysiotherapie');
  const category=Object.values(MUNICIPAL_BUSINESS_LABELS).includes(requestedCategory)?requestedCategory:'Fysiotherapie';
  return <AdvertisingPreview demoMode serviceId="" name="Jouw bedrijf" city={city} category={category} address="" website="" phone="" email="" hours=""/>;
 }
 const found=await resolveMunicipalBusiness(key,city);
 if(!found)return <main className="owner-management"><h1><T>{"Kies je bedrijfsvermelding"}</T></h1><p><T>{"Open je bedrijf in de gemeentegids om beheer aan te vragen of advertenties te kiezen."}</T></p><a href="/#gemeenten"><T>{"Naar de gemeentegids →"}</T></a></main>;
 const {entry:source,area}=found;let entry={...source};const client=createServiceClient();
 if(client){const result=await client.from('events').select('title,address,contact_phone,municipal_email,municipal_hours,website_url,image_url').eq('municipal_key',source.id).eq('status','approved').eq('verified',true).maybeSingle();if(!result.error&&result.data)entry={...entry,name:result.data.title,address:result.data.address||undefined,phone:result.data.contact_phone||undefined,email:result.data.municipal_email||undefined,openingHours:result.data.municipal_hours||undefined,website:result.data.website_url||undefined,...(result.data.image_url?{image_url:result.data.image_url,image_source_url:undefined,image_credit:'Aangeleverd bij de vermelding',image_license:undefined,image_license_url:undefined}:{})};}
 return <AdvertisingPreview photo={{image_url:entry.image_url||'',image_source_url:entry.image_source_url,image_credit:entry.image_credit,image_license:entry.image_license,image_license_url:entry.image_license_url}} serviceId={entry.id} name={entry.name} city={area.name} category={MUNICIPAL_BUSINESS_LABELS[entry.type]||entry.type} address={entry.address||''} website={entry.website||''} phone={entry.phone||''} email={entry.email||''} hours={entry.openingHours||''}/>;
}
