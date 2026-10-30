import {LOCAL_AREA_TOWNS,distanceInKm} from './local-area.ts';
type Position={latitude:number;longitude:number;accuracy?:number};
type Centre={latitude:number|null;longitude:number|null};
export function visitorLocationDecision(position:Position,centres:Centre[]=LOCAL_AREA_TOWNS){
 const {latitude,longitude,accuracy}=position;
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return {location:null,reason:'invalid' as const};
 if(accuracy!=null&&(!Number.isFinite(accuracy)||accuracy>50000))return {location:null,reason:'inaccurate' as const};
 const usable=centres.filter((centre):centre is {latitude:number;longitude:number}=>centre.latitude!=null&&centre.longitude!=null&&Number.isFinite(centre.latitude)&&Number.isFinite(centre.longitude));
 const coverage=usable.length?usable:LOCAL_AREA_TOWNS;
 if(!coverage.some(centre=>distanceInKm(latitude,longitude,centre.latitude,centre.longitude)<=50))return {location:null,reason:'outside' as const};
 return {location:{latitude,longitude},reason:null};
}
export function shouldUseTownFallback(usingLocation:boolean,eventCount:number){return usingLocation&&eventCount===0;}
