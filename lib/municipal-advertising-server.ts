import {municipalPhoto,withMunicipalPhoto} from './municipal-photos';
import {createServiceClient} from './supabase-server';
import {hasAdvertisingPlacement,hasActiveAdvertising,isDemoLayoutAdvertisement} from './event-presentation';
import areas from './data/area-catalog.json';
import {normalizePlaceName} from './local-area';
import type {CatalogService} from './municipal-catalog';
import {canonicalMunicipalBusiness} from './municipal-business';
import {COMMERCIAL_SERVICE_TYPES} from './municipal-shops';
export function municipalRowService(row:MunicipalPaidListing):CatalogService&{managedEventId:string;highlighted:boolean;hasActiveAdvertising:boolean}{
 return {id:row.municipal_key,type:row.municipal_type,codeInsee:row.municipal_code,name:row.title,municipality:row.city,inSelectedMunicipality:true,address:row.address||undefined,phone:row.contact_phone||undefined,email:row.municipal_email||undefined,website:row.website_url||undefined,openingHours:row.municipal_hours||undefined,extra:row.description||row.short_description||undefined,image_url:row.image_url||undefined,image_credit:row.image_url?'Aangeleverd bij de vermelding':undefined,sourceName:'Aangeleverd door ondernemer',sourceUrl:row.website_url||'https://www.cotededuras.com/#gemeenten',managedEventId:row.id,hasActiveAdvertising:hasActiveAdvertising({...row,start_at:''}),highlighted:hasAdvertisingPlacement({...row,start_at:''},'highlight')};
}
export async function resolveMunicipalBusiness(key:string,city:string){
 const canonical=canonicalMunicipalBusiness(key,city);if(canonical)return canonical;
 const area=areas.areas.find(item=>normalizePlaceName(item.name)===normalizePlaceName(city)),client=createServiceClient();
 if(!area||!client)return null;
 const {data,error}=await client.from('events').select(municipalPublicColumns).eq('municipal_key',key).eq('municipal_code',area.code_insee).eq('status','approved').eq('verified',true).maybeSingle();
 return !error&&data&&COMMERCIAL_SERVICE_TYPES.includes(data.municipal_type)?{area,entry:municipalRowService(data)}:null;
}
export const municipalPublicColumns='id,slug,municipal_key,municipal_code,municipal_type,title,city,address,contact_phone,municipal_email,municipal_hours,website_url,image_url,short_description,description,advertising_placements,promotion_type,promotion_status,promotion_start_at,promotion_end_at';
export type MunicipalPaidListing={image_source_url?:string;image_credit?:string;image_license?:string;image_license_url?:string;id:string;slug?:string;municipal_key:string;municipal_code:string;municipal_type:string;title:string;city:string;address:string|null;contact_phone:string|null;municipal_email:string|null;municipal_hours:string|null;website_url:string|null;image_url:string|null;short_description:string|null;description:string|null;advertising_placements:{placement:string;starts_at:string;ends_at:string}[]|null;promotion_type:string;promotion_status:string;promotion_start_at:string|null;promotion_end_at:string|null};
export async function decorateMunicipalDirectory<T extends {city:string;services:{id:string;type:string;name:string;address?:string;phone?:string;email?:string;website?:string;openingHours?:string}[]}>(catalog:T,code:string,service:string,publicClient?:ReturnType<typeof createServiceClient>){
 const mairie='mairie' in catalog?catalog.mairie:null;
 catalog={...catalog,services:catalog.services.map(withMunicipalPhoto),...(mairie&&typeof mairie==='object'&&'id' in mairie&&typeof mairie.id==='string'?{mairie:withMunicipalPhoto(mairie as {id:string;type?:string})}:{})};
 const client=publicClient??createServiceClient();if(!client)return {...catalog,municipalPartners:[],municipalAdvertisingAvailable:false};
 const actualCode=areas.areas.find(area=>normalizePlaceName(area.name)===normalizePlaceName(catalog.city))?.code_insee||code;
 const columns=municipalPublicColumns;
 // Fetch only this municipality or known visible keys, never billing or ownership data.
 const keys=catalog.services.map(entry=>entry.id);
 const batches=Array.from({length:Math.ceil(keys.length/100)},(_,i)=>keys.slice(i*100,(i+1)*100));
 const [overrideBatches,partners]=await Promise.all([Promise.all(batches.map(batch=>client.from('events').select(columns).in('municipal_key',batch).eq('status','approved').eq('verified',true))),client.from('events').select(columns).eq('municipal_code',actualCode).eq('status','approved').eq('verified',true)]);
 const overrides={data:overrideBatches.flatMap(result=>result.data??[]),error:overrideBatches.find(result=>result.error)?.error};
 if(overrides.error||partners.error)return {...catalog,municipalPartners:[],municipalAdvertisingAvailable:false};
 const byKey=new Map((overrides.data as MunicipalPaidListing[]).filter(row=>!isDemoLayoutAdvertisement(row)).map(row=>[row.municipal_key,row]));
 const services=catalog.services.map(entry=>{const row=byKey.get(entry.id);if(!row)return entry;return {...entry,name:row.title,address:row.address||undefined,phone:row.contact_phone||undefined,email:row.municipal_email||undefined,website:row.website_url||undefined,openingHours:row.municipal_hours||undefined,image_url:row.image_url||('image_url' in entry?entry.image_url:undefined),...(row.image_url?{image_source_url:undefined,image_credit:'Aangeleverd bij de vermelding',image_license:undefined,image_license_url:undefined}:{}),managedEventId:row.id,hasActiveAdvertising:hasActiveAdvertising({...row,start_at:''}),highlighted:row.municipal_code===actualCode&&hasAdvertisingPlacement({...row,start_at:''},'highlight')};}).sort((a,b)=>Number('highlighted' in b&&b.highlighted)-Number('highlighted' in a&&a.highlighted));
 const municipalPartners=(partners.data as MunicipalPaidListing[]).filter(row=>!isDemoLayoutAdvertisement(row)&&(hasAdvertisingPlacement({...row,start_at:''},'homepage')||(service!=='all'&&row.municipal_type===service&&hasAdvertisingPlacement({...row,start_at:''},'category')))).slice(0,18).map(row=>({...row,...(row.image_url?{image_credit:'Aangeleverd bij de vermelding'}:municipalPhoto(row.municipal_key)),image_url:row.image_url||municipalPhoto(row.municipal_key)?.image_url||null,municipalPartner:hasAdvertisingPlacement({...row,start_at:''},'homepage')}));
 const known=new Set(services.map(entry=>entry.id));
 const submitted=(partners.data as MunicipalPaidListing[]).filter(row=>!known.has(row.municipal_key)&&COMMERCIAL_SERVICE_TYPES.includes(row.municipal_type)&&(service==='all'||row.municipal_type===service)&&!isDemoLayoutAdvertisement(row)).map(municipalRowService);
 return {...catalog,services:[...services,...submitted].sort((a,b)=>Number('highlighted' in b&&b.highlighted)-Number('highlighted' in a&&a.highlighted)),municipalPartners,municipalAdvertisingAvailable:true};
}
