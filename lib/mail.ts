import nodemailer from 'nodemailer';

export function mailConfiguration(env:NodeJS.ProcessEnv=process.env){
 const required=['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','MAIL_FROM'];
 const missing=required.filter(key=>!env[key]?.trim());
 const host=env.SMTP_HOST?.trim().toLowerCase()??'',port=Number(env.SMTP_PORT),user=env.SMTP_USER?.trim()??'',from=env.MAIL_FROM?.trim()??'';
 const valid=missing.length===0&&['smtp.strato.de','smtp.strato.com'].includes(host)&&port===465&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(user)&&!/[\r\n]/.test(from)&&from.includes(`<${user}>`);
 return {configured:valid,missing,host,port,user,from,deliveryEnabled:valid&&env.VERCEL_ENV==='production'&&env.MAIL_DELIVERY_ENABLED==='true'};
}
export function mailTransport(){
 const config=mailConfiguration();if(!config.configured)throw Error('Controleer de Strato-mailinstellingen.');
 return nodemailer.createTransport({host:config.host,port:465,secure:true,auth:{user:config.user,pass:process.env.SMTP_PASSWORD},authMethod:'LOGIN',tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:12000,greetingTimeout:12000,socketTimeout:20000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
}
export function safeMailError(error:unknown){
 const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
 if(code==='EAUTH')return 'Strato weigert de aanmelding. Controleer het mailboxadres en mailboxwachtwoord in Vercel.';
 if(['ETIMEDOUT','ECONNECTION','ESOCKET','EDNS'].includes(code))return 'De beveiligde verbinding met Strato kon niet worden gemaakt. Controleer de server en probeer later opnieuw.';
 return 'De e-mail kon niet worden verzonden. Controleer de mailinstellingen of probeer later opnieuw.';
}
type Payload={kind?:string;status?:string;title?:string;reference?:string};
export function listingMail(template:string,payload:Payload){
 const title=String(payload.title??'Je vermelding').slice(0,250),reference=String(payload.reference??'');
 if(template==='received')return {subject:'Côte de Duras — je verzoek is ontvangen',text:`Beste bezoeker,\n\nJe ${payload.kind==='claim'?'beheeraanvraag':'correctiemelding'} voor “${title}” is ontvangen.\nReferentie: ${reference}\n\nWe controleren je verzoek. Deze bevestiging geeft geen beheerrechten en verandert niets aan de vermelding. Voor beheer controleren we eerst of je namens de organisatie mag handelen.\n\nMet vriendelijke groet,\nCôte de Duras\ninfo@cotededuras.com`};
 const outcomes:Record<string,string>={approved:'Je beheeraanvraag is na controle goedgekeurd. De beheerder verstrekt de persoonlijke beheerlink afzonderlijk via het onafhankelijk geverifieerde contactkanaal.',rejected:'Je verzoek is beoordeeld en niet goedgekeurd. Voor toelichting kun je op deze e-mail reageren.',resolved:'Je correctiemelding is door de beheerder afgehandeld. Voor vragen kun je op deze e-mail reageren.',revoked:'De eerder verleende beheerrechten zijn ingetrokken. De bijbehorende beheerlink geeft geen toegang meer.'};
 if(!outcomes[String(payload.status)])throw Error('Onbekend berichttype.');
 return {subject:'Côte de Duras — je verzoek is beoordeeld',text:`Beste bezoeker,\n\n${outcomes[String(payload.status)]}\n\nVermelding: ${title}\nReferentie: ${reference}\n\nMet vriendelijke groet,\nCôte de Duras\ninfo@cotededuras.com`};
}
