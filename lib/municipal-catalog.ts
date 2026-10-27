import mapData from "./data/municipal-osm.json";
import officialData from "./data/municipal-official.json";
import centres from "./data/commune-centres.json";
import areas from "./data/area-catalog.json";
import supplements from "./data/municipal-supplements.json";
import mayorData from "./data/mayors.json";
import { distanceInKm, normalizePlaceName } from "./local-area";
import { CURATED_HEALTH_SERVICES } from "./municipality-health";
import { CURATED_LOCAL_SERVICES } from "./municipality-local-services";

type RecordValue = Record<string, unknown>;
export type CatalogService = {
  id: string; type: string; name: string; address?: string; municipality?: string;
  latitude?: number; longitude?: number; phone?: string; email?: string; website?: string;
  openingHours?: string; serviceTimes?: string; mayor?: string; extra?: string;
  mayorSourceUrl?: string; mayorSourceName?: string;
  distanceKm?: number; inSelectedMunicipality?: boolean; sourceUrl: string; sourceName: string;
};
export const MUNICIPAL_TYPES = ["mairie", "doctor", "hospital", "library", "pharmacy", "church", "tourism", "dentist"];
function parsed(value: unknown): unknown { try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return value; } }
function string(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function contact(value: unknown): string | undefined {
  const parts = parsed(value);
  if (Array.isArray(parts)) return parts.map(part => typeof part === "string" ? part : string(part?.valeur)).filter(Boolean).join(" · ") || undefined;
  return string(parts);
}
function officialService(row: RecordValue): CatalogService | null {
  if (!/^Mairie\s*-/i.test(String(row.nom))) return null;
  const address = (parsed(row.adresse) as RecordValue[] | null)?.[0];
  if (!address) return null;
  const opening = parsed(row.plage_ouverture) as RecordValue[] | null;
  const openingHours = Array.isArray(opening) ? opening.map(period => {
    const days = [period.nom_jour_debut, period.nom_jour_fin].filter(Boolean).filter((value,index,list)=>list.indexOf(value)===index).join("–");
    const hours = [1,2].map(index => [period[`valeur_heure_debut_${index}`],period[`valeur_heure_fin_${index}`]].map(value=>String(value??"").slice(0,5)).filter(Boolean).join("–")).filter(Boolean).join(", ");
    return `${days}: ${hours || period.commentaire || ""}`;
  }).join(" · ") : undefined;
  return { id:`dila-${row.id}`,type:"mairie",name:String(row.nom),
    address:[address.numero_voie,address.complement1,address.complement2,address.code_postal,address.nom_commune].filter(Boolean).join(", "),
    municipality:string(address.nom_commune),latitude:Number(address.latitude),longitude:Number(address.longitude),
    phone:contact(row.telephone),email:contact(row.adresse_courriel),website:contact(row.site_internet),openingHours,
    sourceUrl:string(row.url_service_public) ?? "https://lannuaire.service-public.gouv.fr/",sourceName:"Service-Public.gouv.fr / DILA" };
}
function mapType(tags: Record<string,string>): string | undefined {
  if (tags.amenity === "townhall") return "mairie";
  if (tags.amenity === "hospital" || tags.healthcare === "hospital") return "hospital";
  if (tags.amenity === "pharmacy" || tags.healthcare === "pharmacy") return "pharmacy";
  if (tags.amenity === "dentist" || tags.healthcare === "dentist") return "dentist";
  if (["doctors","clinic"].includes(tags.amenity) || ["doctor","clinic"].includes(tags.healthcare)) return "doctor";
  if (tags.amenity === "library") return "library";
  if (tags.amenity === "place_of_worship" && /christian|catholic|protestant|orthodox/i.test(tags.religion ?? "")) return "church";
  if (tags.tourism === "information" && ["office","tourist_information"].includes(tags.information)) return "tourism";
}
const mapped: CatalogService[] = mapData.elements.flatMap(element => {
  const entry = element as {type:string;id:number;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>};
  const tags=entry.tags ?? {}, type=mapType(tags), latitude=entry.lat ?? entry.center?.lat, longitude=entry.lon ?? entry.center?.lon;
  if (!type || !tags.name || latitude == null || longitude == null || tags.disused === "yes" || tags.abandoned === "yes") return [];
  return [{id:`osm-${entry.type}-${entry.id}`,type,name:tags.name,latitude,longitude,
    municipality:tags["addr:city"] ?? tags["addr:place"],address:[tags["addr:housenumber"],tags["addr:street"],tags["addr:postcode"],tags["addr:city"]].filter(Boolean).join(" ") || undefined,
    phone:tags.phone ?? tags["contact:phone"],email:tags.email ?? tags["contact:email"],website:tags.website ?? tags["contact:website"],
    openingHours:tags.opening_hours,serviceTimes:tags.service_times,sourceUrl:`https://www.openstreetmap.org/${entry.type}/${entry.id}`,sourceName:"OpenStreetMap contributors (ODbL)"}];
});
const official=officialData.records.map(row=>officialService(row as unknown as RecordValue)).filter((row):row is CatalogService=>row!==null);
const curated: CatalogService[] = [...CURATED_HEALTH_SERVICES,...CURATED_LOCAL_SERVICES].flatMap(entry=>{
  const centre=areas.areas.find(area=>normalizePlaceName(area.name)===normalizePlaceName(entry.municipality));
  const located=entry as typeof entry & {latitude?:number;longitude?:number};
  const latitude=located.latitude ?? centre?.latitude,longitude=located.longitude ?? centre?.longitude;
  if (latitude==null || longitude==null) return [];
  return [{...entry,latitude,longitude}];
});

export function municipalCatalog(city:string,latitude:number,longitude:number,service="all",codeInsee?:string) {
  const radiusKm=["agen","bergerac"].includes(normalizePlaceName(city)) ? 10 : 25;
  const localCode=codeInsee ?? areas.areas.find(area=>normalizePlaceName(area.name)===normalizePlaceName(city))?.code_insee;
  const localMairie=official.filter(entry=>{
    const row=officialData.records.find(row=>`dila-${row.id}`===entry.id);
    return String(row?.code_insee_commune)===localCode;
  }).map(entry=>{
    const mayor=mayorData.mayors.find(mayor=>mayor.code===localCode) as {name:string;sourceUrl?:string;sourceName?:string}|undefined;
    return {...entry,mayor:entry.mayor||mayor?.name,mayorSourceUrl:mayor?.sourceUrl||mayorData.sourceUrl,mayorSourceName:mayor?.sourceName||mayorData.sourceName};
  });
  const pool:CatalogService[]=[...localMairie,...curated,...supplements.points,...mapped];
  const seen=new Set<string>();
  const services=pool.flatMap(entry=>{
    if (service!=="all" && entry.type!==service) return [];
    if (entry.type==="mairie" && !localMairie.some(local=>local.id===entry.id)) {
      if (normalizePlaceName(entry.municipality ?? "")!==normalizePlaceName(city)) return [];
      if(localMairie.length) return [];
    }
    const distance=distanceInKm(latitude,longitude,entry.latitude!,entry.longitude!);
    if(!Number.isFinite(distance)||distance>radiusKm) return [];
    const key=`${entry.type}:${normalizePlaceName(entry.name)}:${Math.round(entry.latitude!*1000)}:${Math.round(entry.longitude!*1000)}`;
    if(seen.has(key)) return []; seen.add(key);
    return [{...entry,distanceKm:Math.round(distance*10)/10,inSelectedMunicipality:entry.municipality ? normalizePlaceName(entry.municipality)===normalizePlaceName(city) : undefined}];
  }).sort((a,b)=>Number(b.inSelectedMunicipality===true)-Number(a.inSelectedMunicipality===true)||a.distanceKm-b.distanceKm);
  return {city,updatedAt:mapData.updatedAt,radiusKm,officialDirectoryAvailable:localMairie.length>0,mapDataAvailable:true,curatedDataAvailable:true,
    officialEquipmentCounts:[],mairie:services.find(entry=>entry.type==="mairie") ?? null,services,
    sources:[{name:"OpenStreetMap contributors (ODbL)",url:"https://www.openstreetmap.org/copyright"},{name:"Service-Public.gouv.fr / DILA",url:"https://api-lannuaire.service-public.gouv.fr/explore/dataset/api-lannuaire-administration/"}],
    missingTypes:(service==="all"?MUNICIPAL_TYPES:[service]).filter(type=>!services.some(entry=>entry.type===type))};
}
