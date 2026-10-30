import {normalizeWebAddress} from './web-address.ts';
export function visitorEventInput(value:unknown,updating=false){
  if(!value||typeof value!=='object')throw Error('De vermelding kon niet worden gelezen.');
  const input=value as Record<string,unknown>,event:Record<string,unknown>={};
  for(const key of ['title','short_description','description','venue_name','address','postcode','city','contact_phone']){
    event[key]=typeof input[key]==='string'?(input[key] as string).trim():'';
    if((event[key] as string).length>(key==='description'?12000:key==='short_description'?250:250))throw Error('Een tekstveld is te lang.');
  }
  if(!event.title||!event.city)throw Error('Vul een titel en plaats in.');
  event.is_directory_entry=input.is_directory_entry===true;
  for(const key of ['start_at','end_at']){
    const date=input[key];
    if(!event.is_directory_entry&&date&&typeof date==='string'&&Number.isFinite(Date.parse(date)))event[key]=new Date(date).toISOString();
    else if(date&&!event.is_directory_entry)throw Error('Controleer de datums.');else event[key]=null;
  }
  if(!event.is_directory_entry&&!event.start_at)throw Error('Vul een begindatum in.');
  if(event.start_at&&event.end_at&&Date.parse(String(event.end_at))<Date.parse(String(event.start_at)))throw Error('De einddatum ligt voor de begindatum.');
  for(const key of ['website_url','booking_url','source_url']){
    event[key]=normalizeWebAddress(typeof input[key]==='string'?input[key] as string:'');
    if(!event[key]&&(!updating||key==='source_url'))throw Error('Vul een geldig website-, reserverings- en bronadres in.');
  }
  event.is_free=input.is_free===true;
  for(const key of ['price_from','price_to']){
    const amount=input[key];event[key]=event.is_free||amount==null||amount===''?null:Number(amount);
    if(event[key]!=null&&(!Number.isFinite(event[key])||Number(event[key])<0))throw Error('Vul een geldig eurobedrag in.');
  }
  if(input.image_url!==undefined){
    const photo=typeof input.image_url==='string'?normalizeWebAddress(input.image_url):null;
    const origin=process.env.NEXT_PUBLIC_SUPABASE_URL;
    if(photo&&(!origin||!photo.startsWith(origin+'/storage/v1/object/public/visitor-event-photos/visitor-submissions/')))throw Error('Upload de foto via het formulier.');
    event.image_url=photo;
  }
  if(!updating){
    const type=input.promotion_type??'none';if(!['none','homepage','category','highlight'].includes(String(type)))throw Error('Kies een geldige promotievorm.');
    event.promotion_type=type;event.submission_kind='manual';
  }
  return event;
}
