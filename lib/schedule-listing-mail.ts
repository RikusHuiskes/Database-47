import {after} from 'next/server';
import {mailConfiguration} from './mail';
import {processMailOutbox} from './mail-outbox';

export function scheduleListingMail(eventId:string){
 if(mailConfiguration().deliveryEnabled)after(async()=>{
  try{await processMailOutbox(1,eventId);}catch{console.error('[listing-approval] mail remains queued for retry');}
 });
}
