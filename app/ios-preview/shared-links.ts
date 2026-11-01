import type {SavedEntry} from './saved-entries';
export type SharedRequest={kind:'event';id:string}|{kind:'service';id:string;townId:string;serviceType:string}|{kind:'invalid';message:string};
export function parseSharedRequest(search:string,townIds:readonly string[],serviceTypes:readonly string[]):SharedRequest|null{
 const params=new URLSearchParams(search),event=params.get('event'),service=params.get('service');
 if(!params.has('event')&&!params.has('service'))return null;
 const invalid:SharedRequest={kind:'invalid',message:'Deze deellink is niet geldig. Je kunt hieronder verder zoeken.'};
 if(params.has('event')&&params.has('service'))return invalid;
 if(params.has('event'))return event&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event)?{kind:'event',id:event}:invalid;
 const townId=params.get('town')||'',serviceType=params.get('type')||'';
 if(!service||service.length>500||!townIds.includes(townId)||!serviceTypes.includes(serviceType))return invalid;
 return {kind:'service',id:service,townId,serviceType};
}
export function sharedEntryUrl(value:SavedEntry,origin:string){
 const base=new URL('/ios-preview',origin);
 if(value.kind==='event'){base.searchParams.set('event',value.item.id);return base.href;}
 if(value.context){base.searchParams.set('town',value.context.townId);base.searchParams.set('type',value.context.serviceType);base.searchParams.set('service',value.item.id);return base.href;}
 // Old favourites have no municipality context. Keep their official source usable.
 const source=value.item.website||value.item.sourceUrl;
 return source&&/^https?:\/\//i.test(source)?source:base.href;
}
