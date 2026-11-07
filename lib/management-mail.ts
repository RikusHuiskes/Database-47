import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
type Access={eventId:string;token:string;origin:string};
function key(env:NodeJS.ProcessEnv){const secret=env.MANAGEMENT_MAIL_KEY||env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY;if(!secret)throw Error('De beveiligde beheerlinkmail is niet ingesteld.');return createHash('sha256').update('cdd-management-mail-v1:'+secret).digest();}
export function sealManagementMail(access:Access,env:NodeJS.ProcessEnv=process.env){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(env),iv);const data=Buffer.concat([cipher.update(JSON.stringify(access),'utf8'),cipher.final()]);return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');}
export function openManagementMail(value:string,env:NodeJS.ProcessEnv=process.env):Access{const [version,iv,tag,data,...extra]=value.split('.');if(version!=='v1'||!data||extra.length)throw Error('Ongeldig beveiligd bericht.');const decipher=createDecipheriv('aes-256-gcm',key(env),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));const access=JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8'));if(!/^[a-f\d-]{36}$/i.test(access.eventId)||!/^[A-Za-z0-9_-]{43}$/.test(access.token)||new URL(access.origin).origin!==access.origin||!access.origin.startsWith('https://'))throw Error('Ongeldige beheerlink.');return access;}
// The database assigns the event UUID inside the submission transaction. This
// reserved ID marks a sealed submission token; delivery binds it to the FK and
// verifies its hash against that event's private owner access before sending.
const submissionMarker='00000000-0000-0000-0000-000000000000';
export function sealSubmissionMail(access:Omit<Access,'eventId'>,env:NodeJS.ProcessEnv=process.env){return sealManagementMail({...access,eventId:submissionMarker},env);}
export function openSubmissionMail(value:string,eventId:string,env:NodeJS.ProcessEnv=process.env):Access{
 const access=openManagementMail(value,env);
 if(access.eventId!==submissionMarker||! /^[a-f\d-]{36}$/i.test(eventId)||eventId===submissionMarker)throw Error('Onjuiste beheerlink.');
 return {...access,eventId};
}
export function submissionApprovedMessage(access:Access,title:string,locale:string='fr'){
 const name=title.slice(0,250),url=`${access.origin}/mijn-vermelding#${access.eventId}:${access.token}`;
 const copy=locale==='nl'?{
  subject:'Je vermelding is goedgekeurd',
  text:`Beste bezoeker,\n\nJe vermelding “${name}” is goedgekeurd en staat nu op Côte de Duras.\n\nMet je persoonlijke beheerlink kun je gegevens en foto’s aanpassen, een advertentie aanvragen en je betalingen bekijken:\n\n${url}\n\nBewaar deze link als een wachtwoord en deel hem niet. Het is dezelfde beheerlink die je bij het aanmelden hebt ontvangen. Wijzigingen worden opnieuw gecontroleerd. Betaalde advertenties verschijnen na betaalbevestiging, binnen de gekozen periode.\n\nMet vriendelijke groet,`
 }:locale==='en'?{
  subject:'Your listing has been approved',
  text:`Hello,\n\nYour listing “${name}” has been approved and is now on Côte de Duras.\n\nUse your personal management link to edit details and photos, request advertising and view your payments:\n\n${url}\n\nKeep this link private, just like a password. It is the same link you received when submitting your listing. Changes are reviewed again. Paid advertisements appear after payment confirmation, during the selected period.\n\nKind regards,`
 }:{
  subject:'Votre annonce a été approuvée',
  text:`Bonjour,\n\nVotre annonce « ${name} » a été approuvée et figure désormais sur Côte de Duras.\n\nVotre lien personnel vous permet de modifier les informations et les photos, de demander une publicité et de consulter vos paiements :\n\n${url}\n\nConservez ce lien comme un mot de passe et ne le partagez pas. Il s’agit du même lien que celui reçu lors de votre inscription. Les modifications sont à nouveau vérifiées. Les publicités payantes sont diffusées après confirmation du paiement, pendant la période choisie.\n\nCordialement,`
 };
 return {subject:'Côte de Duras — '+copy.subject,text:copy.text+'\nCôte de Duras\ninfo@cotededuras.com'};
}
export function managementMailMessage(access:Access,title:string){return {subject:'Côte de Duras — je persoonlijke beheerlink',text:`Beste bezoeker,\n\nJe beheeraanvraag voor “${title.slice(0,250)}” is goedgekeurd.\n\nMet deze persoonlijke link kun je jouw vermelding beheren en eventueel upgraden naar een advertentie:\n\n${access.origin}/mijn-vermelding#${access.eventId}:${access.token}\n\nBewaar deze link als een wachtwoord en deel hem niet. Bij herstel is je eerdere beheerlink vervallen.\n\nMet vriendelijke groet,\nCôte de Duras\ninfo@cotededuras.com`};}
export function managementMailTokenHash(access:Access){return createHash('sha256').update(access.token).digest('hex');}
