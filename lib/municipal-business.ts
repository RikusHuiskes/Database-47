import areas from './data/area-catalog.json';
import {municipalCatalog,type CatalogService} from './municipal-catalog';
import {normalizePlaceName} from './local-area';
import {COMMERCIAL_SERVICE_TYPES} from './municipal-shops';
export function canonicalMunicipalBusiness(serviceId:string,city:string):{entry:CatalogService;area:(typeof areas.areas)[number]}|null{
 const area=areas.areas.find(area=>normalizePlaceName(area.name)===normalizePlaceName(city));if(!area)return null;
 const entry=municipalCatalog(area.name,area.latitude,area.longitude,'all',area.code_insee).services.find(entry=>entry.id===serviceId);
 if(!entry||!COMMERCIAL_SERVICE_TYPES.includes(entry.type))return null;
 const actual=areas.areas.find(area=>entry.codeInsee?area.code_insee===entry.codeInsee:normalizePlaceName(area.name)===normalizePlaceName(entry.municipality||''));
 return actual?{entry,area:actual}:null;
}
