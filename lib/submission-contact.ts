import {sealSubmissionMail} from './management-mail';

/** Private delivery details, never copied into the public events row. */
export function submissionContact(email:unknown,locale:unknown,token:string,origin:string){
 const recipient=typeof email==='string'?email.trim().toLowerCase():'';
 if(recipient.length>254||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))throw Error('Vul je e-mailadres voor de persoonlijke beheerlink in.');
 return {recipient,locale:locale==='nl'||locale==='en'?locale:'fr',encrypted_secret:sealSubmissionMail({token,origin})};
}
