import {addDays,calendarDay,isCurrentEvent,isLongRunning,type AppEvent} from './app-model';
export function canSaveEventDate(event:AppEvent,now=new Date()){
 const start=calendarDay(event.start_at),end=calendarDay(event.end_at||event.start_at);
 return !event.is_directory_entry&&isCurrentEvent(event,now)&&!isLongRunning(event)&&!!start&&start>=calendarDay(now)&&!!end&&(Date.parse(end)-Date.parse(start))/86400000<=31;
}
export function calendarText(value:string){return value.replace(/\\/g,'\\\\').replace(/\r\n|\n|\r/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');}
/** RFC 5545 folding counts UTF-8 octets and never splits a code point. */
export function foldCalendarLine(line:string){
 const encoder=new TextEncoder();let output='',current='',bytes=0;
 for(const character of line){const size=encoder.encode(character).length;if(bytes+size>75){output+=current+'\r\n';current=' ';bytes=1;}current+=character;bytes+=size;}
 return output+current;
}
/** A one-day reminder deliberately avoids inventing a time or a recurrence. */
export function createEventDateReminder(event:AppEvent,url:string,now=new Date()){
 if(!canSaveEventDate(event,now))throw Error('Er is geen concrete aankomende datum om te bewaren.');
 const day=calendarDay(event.start_at),end=addDays(day,1);
 const description=['Dagnotitie voor de begindatum van dit evenement. Controleer de precieze dagen en tijden bij de organisator.',event.short_description||'',url].filter(Boolean).join('\n\n');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Cote de Duras//Bezoekersapp//NL','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:cote-de-duras-'+encodeURIComponent(event.id),'DTSTAMP:'+now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'),'DTSTART;VALUE=DATE:'+day.replace(/-/g,''),'DTEND;VALUE=DATE:'+end.replace(/-/g,''),'SUMMARY:'+calendarText(event.title),'DESCRIPTION:'+calendarText(description),'TRANSP:TRANSPARENT'];
 const location=[event.address,event.city].filter(Boolean).join(', ');if(location)lines.push('LOCATION:'+calendarText(location));
 try{const parsed=new URL(url);if(['https:','http:'].includes(parsed.protocol))lines.push('URL:'+parsed.href);}catch{/* No URL is safer than a malformed calendar property. */}
 lines.push('END:VEVENT','END:VCALENDAR');return lines.map(foldCalendarLine).join('\r\n')+'\r\n';
}
