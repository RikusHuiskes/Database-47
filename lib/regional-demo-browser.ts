import {REGION} from './site-region';
export const demoStorageKey=()=>`cote-demo:${REGION.key}:listings`;
export function demoListings():Record<string,unknown>[]{try{const records=JSON.parse(localStorage.getItem(demoStorageKey())||'[]');return Array.isArray(records)?records:[];}catch{return [];}}
export function saveDemoListing(event:Record<string,unknown>){const rows=demoListings(),index=rows.findIndex(row=>row.id===event.id);if(index>=0)rows[index]=event;else rows.push(event);localStorage.setItem(demoStorageKey(),JSON.stringify(rows));}
