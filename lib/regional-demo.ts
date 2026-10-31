import snapshot from './regions/active.json';
import {distanceInKm} from './local-area';
type Row={id:string;title:string;start_at:string;end_at?:string|null;is_directory_entry?:boolean;latitude:number;longitude:number;category_ids:string[];[key:string]:unknown};
export const regionalCatalog=snapshot as unknown as {key:string;brand:string;city:string;updatedAt:string;latitude:number;longitude:number;categories:{id:string;slug:string;name:string}[];events:Row[];areas:{id:string;name:string;postcode:string;latitude:number;longitude:number;code_insee:string;distance_group:string}[];sources:unknown[]};
export function regionalResults(params:URLSearchParams){
 const lat=Number(params.get('lat')),lon=Number(params.get('lon')),radius=Math.min(50,Math.max(5,Number(params.get('radius'))||50)),category=params.get('category')||'all';
 if(!params.has('lat')||!params.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Kies een geldige plaats.');
 const now=Date.now();
 const events=regionalCatalog.events.filter(e=>(e.is_directory_entry||new Date(e.end_at||e.start_at).getTime()>=now)&&(category==='all'||e.category_ids.includes(category))).map(e=>({...e,distance_km:Math.round(distanceInKm(lat,lon,e.latitude,e.longitude)*10)/10,distance_is_approximate:false})).filter(e=>e.distance_km<=radius).sort((a,b)=>a.distance_km-b.distance_km||a.start_at.localeCompare(b.start_at));
 return {events,homepage_promotions:[],category_promotions:[],radius_km:radius,locationless_count:0,demo:true,updatedAt:regionalCatalog.updatedAt};
}
