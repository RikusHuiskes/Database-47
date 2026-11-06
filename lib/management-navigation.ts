export function managementFragment(value:unknown){
 if(typeof value!=='string')return null;
 const fragment=value.includes('#')?value.slice(value.indexOf('#')+1):value;
 const match=fragment.match(/^([a-f0-9-]{36}):([A-Za-z0-9_-]{43})$/i);
 return match?{id:match[1],token:match[2],fragment}:null;
}
export function matchingManagementLink(eventId:string,saved:unknown,session:unknown){
 const current=managementFragment(session);if(current?.id===eventId)return current;
 if(Array.isArray(saved))for(const item of saved){const access=managementFragment(item?.fragment);if(access?.id===eventId)return access;}
 return null;
}

export type ManagementTarget={id:string;title:string;serviceId?:string;city?:string};
export type OwnerSection='edit'|'advertise'|'payments'|'access';
export function managementDestination(params:URLSearchParams){
 const id=params.get('eventId')??'',serviceId=(params.get('serviceId')??'').slice(0,250),city=(params.get('city')??'').slice(0,150);
 const validId=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id);
 const target:ManagementTarget|null=validId||(serviceId&&city)?{id:validId?id:'',title:(params.get('title')||'Deze vermelding').slice(0,250),serviceId,city}:null;
 const view=params.get('onderdeel');
 const section:OwnerSection=view==='betalingen'?'payments':params.get('upgrade')==='1'?'advertise':view==='hulp'?'access':'edit';
 return {target,section};
}

export function canResumeAdvertisement(order:{payment_status:string;ends_on:string},now=new Date()){
 return ['requested','open','expired','failed','canceled'].includes(order.payment_status)&&new Date(order.ends_on+'T00:00:00Z')>now;
}
export function advertisementPaymentLabel(status:string){
 return ({requested:'Nog te betalen',open:'Betaling gestart',paid:'Betaald',expired:'Betaallink verlopen',failed:'Betaling mislukt',canceled:'Betaling afgebroken',refunded:'Terugbetaald',pending:'In verwerking'} as Record<string,string>)[status]??'Status wordt gecontroleerd';
}
