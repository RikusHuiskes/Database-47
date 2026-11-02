import type {Locale} from '../../lib/i18n';
const intlLocale:Record<Locale,string>={nl:'nl-NL',en:'en-GB',fr:'fr-FR'};
export type AppEvent = {
 id:string;title:string;start_at:string;category_ids?:string[];category_id?:string|null;end_at?:string|null;is_directory_entry?:boolean;
 city?:string|null;address?:string|null;short_description?:string|null;description?:string|null;
 image_url?:string|null;is_free?:boolean|null;website_url?:string|null;booking_url?:string|null;
 contact_phone?:string|null;source_url?:string|null;distance_km?:number;
 advertising_placements?:{placement:string;starts_at:string;ends_at:string}[]|null;
 promotion_status?:string|null;promotion_type?:string|null;promotion_start_at?:string|null;promotion_end_at?:string|null;
};
export type DateFilter='all'|'today'|'tomorrow'|'weekend'|'week';
const frenchDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'});
const dateFormatters=Object.fromEntries((['nl','en','fr'] as Locale[]).map(locale=>[locale,new Intl.DateTimeFormat(intlLocale[locale],{timeZone:'Europe/Paris',day:'numeric',month:'long',year:'numeric'})])) as Record<Locale,Intl.DateTimeFormat>;
export function calendarDay(value:string|Date){
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){const parsed=new Date(value+'T12:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?value:'';}
 const parsed=new Date(value);return Number.isFinite(parsed.getTime())?frenchDay.format(parsed):'';
}
export function addDays(day:string,count:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);}
export const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('nl').trim();
/** A multi-year source period is not proof of an occurrence on any chosen day. */
export function isLongRunning(event:Pick<AppEvent,'start_at'|'end_at'|'is_directory_entry'>){
 if(event.is_directory_entry)return false;
 const start=calendarDay(event.start_at),end=calendarDay(event.end_at||'');
 return !!start&&!!end&&(Date.parse(end)-Date.parse(start))/86400000>366;
}
export function isCurrentEvent(event:AppEvent,now=new Date()){
 if(event.is_directory_entry)return true;
 const start=calendarDay(event.start_at),end=calendarDay(event.end_at||event.start_at);
 if(!start||!end||end<start)return false;
 const relevant=event.end_at||event.start_at;
 return /^\d{4}-\d{2}-\d{2}$/.test(relevant)?end>=calendarDay(now):Date.parse(relevant)>=now.getTime();
}
export function eventDate(event:Pick<AppEvent,'start_at'|'end_at'|'is_directory_entry'>,now=new Date(),locale:Locale='nl'){
 const words={nl:{year:'Het hele jaar ontdekken',unknown:'Datum bij de organisator',past:'Afgelopen · ',long:'Langlopende activiteit · actuele dagen bij de organisator',until:'Loopt t/m ',to:' t/m '},en:{year:'Discover all year round',unknown:'Check the date with the organiser',past:'Past event · ',long:'Long-running activity · check current dates with the organiser',until:'Runs until ',to:' to '},fr:{year:'À découvrir toute l’année',unknown:'Date à vérifier auprès de l’organisateur',past:'Événement passé · ',long:'Activité de longue durée · dates à vérifier auprès de l’organisateur',until:'Jusqu’au ',to:' au '}}[locale];
 if(event.is_directory_entry)return words.year;
 const start=calendarDay(event.start_at),end=calendarDay(event.end_at||event.start_at),today=calendarDay(now);
 const format=(d:string)=>dateFormatters[locale].format(new Date(d+'T12:00:00Z'));
 if(!start||!end)return words.unknown;
 if(end<today)return words.past+format(end);
 if(isLongRunning(event))return words.long;
 if(end>start)return `${start<today&&end>=today?words.until+format(end):format(start)+words.to+format(end)}`;
 return format(start);
}
export function matchesDate(event:AppEvent,filter:DateFilter,now=new Date()){
 if(!isCurrentEvent(event,now))return false;
 if(filter==='all')return true;if(event.is_directory_entry||isLongRunning(event))return false;
 const start=calendarDay(event.start_at),end=calendarDay(event.end_at||event.start_at),today=calendarDay(now);
 if(!start||!end)return false;
 let from=today,to=today;
 if(filter==='tomorrow')from=to=addDays(today,1);
 if(filter==='week')to=addDays(today,6);
 if(filter==='weekend'){const weekday=new Date(today+'T12:00:00Z').getUTCDay();from=addDays(today,weekday===0?-1:(6-weekday+7)%7);to=addDays(from,1);}
 return start<=to&&end>=from;
}
export type EventFilters={query:string;when:DateFilter;kind:string;city:string;radius:number;freeOnly:boolean;category?:string;sort?:'date'|'distance'|'name'};
export function filterEvents(events:AppEvent[],filters:EventFilters,now=new Date()){
 const term=normalize(filters.query);
 return events.filter(event=>{
  if(filters.kind==='events'&&event.is_directory_entry||filters.kind==='addresses'&&!event.is_directory_entry)return false;
  if(filters.category&&!(event.category_ids??(event.category_id?[event.category_id]:[])).includes(filters.category))return false;
  if(filters.city&&normalize(event.city||'')!==normalize(filters.city))return false;
  if(filters.radius<50&&(!Number.isFinite(event.distance_km)||event.distance_km!>filters.radius))return false;
  if(filters.freeOnly&&event.is_free!==true)return false;
  if(term&&!normalize([event.title,event.city,event.address,event.short_description].filter(Boolean).join(' ')).includes(term))return false;
  return matchesDate(event,filters.when,now);
 }).sort((a,b)=>{
  if(filters.sort==='distance'){
   const left=Number.isFinite(a.distance_km)?a.distance_km!:Infinity,right=Number.isFinite(b.distance_km)?b.distance_km!:Infinity;
   if(left!==right)return left<right?-1:1;
  }
  if(filters.sort==='name')return a.title.localeCompare(b.title,'nl');
  return Number(!!a.is_directory_entry)-Number(!!b.is_directory_entry)||Math.max(Date.parse(a.start_at)||0,now.getTime())-Math.max(Date.parse(b.start_at)||0,now.getTime())||a.title.localeCompare(b.title,'nl');
 });
}
