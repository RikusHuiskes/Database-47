import {decodeSavedEntries,type SavedEntry} from './saved-entries';
const format='cote-de-duras-favourites';
const textFields=['title','start_at','end_at','city','address','short_description','description','image_url','website_url','booking_url','contact_phone','source_url','promotion_status','promotion_type','promotion_start_at','promotion_end_at','category_id','name','type','municipality','phone','email','website','openingHours','sourceUrl','image_source_url','image_credit','image_license','image_license_url'];
/** Keep backups limited to public listing fields; never include unknown imported metadata. */
function publicSnapshot(row:SavedEntry):SavedEntry{
 const input=row.item as unknown as Record<string,unknown>,item:Record<string,unknown>={id:input.id};
 for(const field of [...textFields,'distance_km','distanceKm','is_free','is_directory_entry'])if(input[field]!=null)item[field]=input[field];
 if(Array.isArray(input.category_ids))item.category_ids=[...input.category_ids];
 if(Array.isArray(input.advertising_placements))item.advertising_placements=input.advertising_placements.map(ad=>({placement:ad.placement,starts_at:ad.starts_at,ends_at:ad.ends_at}));
 return {kind:row.kind,item,...(row.savedAt?{savedAt:row.savedAt}:{}),...(row.context?{context:{townId:row.context.townId,serviceType:row.context.serviceType}}:{})} as SavedEntry;
}
export function createFavouritesBackup(entries:SavedEntry[],now=new Date()){
 return JSON.stringify({format,version:1,exportedAt:now.toISOString(),entries:decodeSavedEntries(JSON.stringify(entries)).map(publicSnapshot)},null,2);
}
export function readFavouritesBackup(raw:string):SavedEntry[]{
 if(raw.length>10*1024*1024)throw Error('Dit bestand is te groot. Kies een reservekopie van maximaal 10 MB.');
 let backup:unknown;try{backup=JSON.parse(raw);}catch{throw Error('Dit is geen leesbare reservekopie. Je bestaande favorieten blijven behouden.');}
 const value=backup as {format?:string;version?:number;entries?:unknown[]};
 if(!value||value.format!==format||value.version!==1||!Array.isArray(value.entries)||value.entries.length>200)throw Error('Kies een reservekopie die met Cote de Duras is gemaakt. Je bestaande favorieten blijven behouden.');
 const entries=decodeSavedEntries(JSON.stringify(value.entries));
 if(entries.length!==value.entries.length)throw Error('De reservekopie bevat ongeldige of dubbele vermeldingen. Je bestaande favorieten blijven behouden.');
 return entries.map(publicSnapshot);
}
export function mergeFavourites(existing:SavedEntry[],incoming:SavedEntry[]){
 const merged=decodeSavedEntries(JSON.stringify([...existing,...incoming]));
 return {entries:merged,added:Math.max(0,merged.length-existing.length),atCapacity:merged.length>=200};
}

