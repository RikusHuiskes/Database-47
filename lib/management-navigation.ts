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
