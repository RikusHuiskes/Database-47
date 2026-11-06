import areas from './data/area-catalog.json';
import {COMMERCIAL_SERVICE_TYPES} from './municipal-shops';
import {normalizeWebAddress} from './web-address';

/** Only public business fields are accepted. Publication and ownership are server decisions. */
export function municipalSubmission(value:unknown,id:string,storageUrl:string|undefined){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Controleer de bedrijfsgegevens.');
 const input=value as Record<string,unknown>;
 const text=(key:string,max=250)=>{const v=typeof input[key]==='string'?input[key].trim():'';if(v.length>max)throw Error('Een tekstveld is te lang.');return v;};
 const title=text('title'),address=text('address'),postcode=text('postcode'),code=text('municipal_code'),type=text('municipal_type');
 const area=areas.areas.find(item=>item.code_insee===code);
 if(!title||!address||!/^\d{5}$/.test(postcode)||!area)throw Error('Vul bedrijfsnaam, adres, postcode en gemeente in.');
 if(!COMMERCIAL_SERVICE_TYPES.includes(type))throw Error('Kies een geldige bedrijfsrubriek.');
 const email=text('municipal_email');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Controleer het e-mailadres.');
 const website=text('website_url',1000),websiteUrl=website?normalizeWebAddress(website):null;
 if(website&&!websiteUrl)throw Error('Vul een volledig websiteadres in.');
 const image=text('image_url',1000),prefix=storageUrl?.replace(/\/$/,'')+'/storage/v1/object/public/visitor-event-photos/visitor-submissions/';
 if(image&&(!storageUrl||!image.startsWith(prefix)||!/^[-a-f0-9]{36}\.(jpg|png|webp)$/.test(image.slice(prefix.length))))throw Error('Upload de foto via het formulier.');
 return {id,slug:'municipal-'+id,title,address,postcode,city:area.name,municipal_key:'submitted:'+id,municipal_code:code,municipal_type:type,
  municipal_email:email||null,municipal_hours:text('municipal_hours',1000)||null,contact_phone:text('contact_phone')||null,
  website_url:websiteUrl,source_url:websiteUrl||'https://www.cotededuras.com/#gemeenten',image_url:image||null,
  short_description:text('short_description'),description:text('description',12000),
  status:'pending',verified:false,is_directory_entry:true,is_manual_entry:true,start_at:null,end_at:null,promotion_type:'none',promotion_status:'none'};
}
