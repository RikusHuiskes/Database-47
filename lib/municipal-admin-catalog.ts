import areas from './data/area-catalog.json';
import {municipalCatalog} from './municipal-catalog';
import {COMMERCIAL_SERVICE_TYPES} from './municipal-shops';
export type MunicipalAdminItem={status?:string;verified?:boolean;id:string;title:string;city:string;municipal_key:string;municipal_code:string;municipal_type:string;address:string;contact_phone:string;municipal_email:string;municipal_hours:string;website_url:string;description:string;promotion_status:string;image_url:string};
let catalog:MunicipalAdminItem[]|undefined;
export function municipalAdminCatalog():MunicipalAdminItem[]{
 if(catalog)return catalog;
 const entries=new Map<string,MunicipalAdminItem>();
 for(const area of areas.areas){
  for(const entry of municipalCatalog(area.name,area.latitude,area.longitude,'all',area.code_insee,false).services){
   if(!COMMERCIAL_SERVICE_TYPES.includes(entry.type)||!entry.inSelectedMunicipality||entries.has(entry.id))continue;
   entries.set(entry.id,{id:'catalog:'+entry.id,title:entry.name,city:area.name,municipal_key:entry.id,municipal_code:area.code_insee,municipal_type:entry.type,address:entry.address||'',contact_phone:entry.phone||'',municipal_email:entry.email||'',municipal_hours:entry.openingHours||'',website_url:entry.website||'',description:entry.extra||'',promotion_status:'none',image_url:entry.image_url||''});
  }
 }
 catalog=[...entries.values()];return catalog;
}
export function municipalAdminResults(catalog:MunicipalAdminItem[],registered:MunicipalAdminItem[],code:string,type:string,page:number,status=''){
 const merged=new Map(catalog.map(item=>[item.municipal_key,item]));
 for(const item of registered)merged.set(item.municipal_key,item);
 const items=[...merged.values()].filter(item=>(!code||item.municipal_code===code)&&(!type||item.municipal_type===type)&&(!status||(item.status||'approved')===status)).sort((a,b)=>Number(b.status==='pending')-Number(a.status==='pending')||a.city.localeCompare(b.city,'fr')||a.title.localeCompare(b.title,'fr'));
 return {items:items.slice((page-1)*25,page*25),total:items.length};
}
