import type {AppEvent} from './app-model';
export type AppService={id:string;type:string;name:string;address?:string;municipality?:string;phone?:string;email?:string;website?:string;openingHours?:string;sourceUrl?:string;image_url?:string;image_source_url?:string;image_credit?:string;image_license?:string;image_license_url?:string;distanceKm?:number};
export type SavedEntry=({kind:'event';item:AppEvent}|{kind:'service';item:AppService})&{savedAt?:number;context?:{townId:string;serviceType:string}};
export function decodeSavedEntries(raw:string):SavedEntry[]{
 let rows:unknown;try{rows=JSON.parse(raw);}catch{return [];}
 if(!Array.isArray(rows))return [];
 const seen=new Set<string>();
 return rows.filter((row):row is SavedEntry=>{
  if(!row||typeof row!=='object'||!['event','service'].includes(row.kind)||!row.item||typeof row.item!=='object')return false;
  const item=row.item;
  if(typeof item.id!=='string'||!item.id||item.id.length>500)return false;
  if(row.kind==='event'&&(typeof item.title!=='string'||typeof item.start_at!=='string'))return false;
  if(row.kind==='service'&&(typeof item.name!=='string'||typeof item.type!=='string'))return false;
  const textFields=['title','start_at','end_at','city','address','short_description','description','image_url','website_url','booking_url','contact_phone','source_url','promotion_status','promotion_type','promotion_start_at','promotion_end_at','category_id','name','type','municipality','phone','email','website','openingHours','sourceUrl','image_source_url','image_credit','image_license','image_license_url'];
  if(textFields.some(key=>item[key]!=null&&typeof item[key]!=='string'))return false;
  if(['distance_km','distanceKm'].some(key=>item[key]!=null&&(typeof item[key]!=='number'||!Number.isFinite(item[key]))))return false;
  if(['is_directory_entry','is_free'].some(key=>item[key]!=null&&typeof item[key]!=='boolean'))return false;
  if(item.category_ids!=null&&(!Array.isArray(item.category_ids)||item.category_ids.some((id:unknown)=>typeof id!=='string')))return false;
  if(item.advertising_placements!=null&&(!Array.isArray(item.advertising_placements)||item.advertising_placements.some((ad:Record<string,unknown>)=>!ad||typeof ad.placement!=='string'||typeof ad.starts_at!=='string'||typeof ad.ends_at!=='string')))return false;
  if(row.context!=null&&(!row.context||typeof row.context!=='object'||typeof row.context.townId!=='string'||typeof row.context.serviceType!=='string'||row.context.townId.length>100||row.context.serviceType.length>100))return false;
  const identity=row.kind+':'+item.id;if(seen.has(identity))return false;seen.add(identity);return true;
 }).slice(0,200).map(row=>{const copy={...row};if(typeof copy.savedAt!=='number'||!Number.isFinite(copy.savedAt)||copy.savedAt<=0)delete copy.savedAt;return copy;});
}
export function savedEventNotice(event:AppEvent,liveEvents:Map<string,AppEvent>,loaded:boolean,failed:boolean){
 if(failed)return 'Bewaarde gegevens · actuele agenda niet bereikbaar';
 if(!loaded)return 'Bewaarde gegevens · agenda wordt gecontroleerd';
 if(liveEvents.has(event.id))return 'Actuele agendagegevens';
 return 'Niet meer gevonden in de actuele agenda · controleer de bron';
}
