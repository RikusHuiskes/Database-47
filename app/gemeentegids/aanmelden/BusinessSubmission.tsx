'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {T,useLanguage} from '../../i18n/Language';
import areas from '../../../lib/data/area-catalog.json';
import {MUNICIPAL_BUSINESS_LABELS} from '../../../lib/municipal-shops';
import {prepareEventPhoto} from '../../../lib/event-photo-browser';
import s from './BusinessSubmission.module.css';
export default function BusinessSubmission(){
 const {t,locale}=useLanguage(),submitLock=useRef(false);
 const [photo,setPhoto]=useState<File|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[fragment,setFragment]=useState(''),[title,setTitle]=useState(''),[copied,setCopied]=useState(false);
 useEffect(()=>{if(!photo){setPreview('');return;}const url=URL.createObjectURL(photo);setPreview(url);return()=>URL.revokeObjectURL(url);},[photo]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(submitLock.current)return;submitLock.current=true;setBusy(true);setError('');
  const fields=Object.fromEntries(new FormData(e.currentTarget).entries());let uploadPath='';
  try{
   if(photo){const body=new FormData();body.set('photo',await prepareEventPhoto(photo));const response=await fetch('/api/visitor-event-photo',{method:'POST',body});const result=await response.json();if(!response.ok)throw Error(result.error);fields.image_url=result.imageUrl;uploadPath=result.path;}
   const response=await fetch('/api/municipal-submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,locale})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   setFragment(result.manageFragment);setTitle(String(fields.title));uploadPath='';
   try{const previous=JSON.parse(localStorage.getItem('cdd-managed-links')||'[]');localStorage.setItem('cdd-managed-links',JSON.stringify([{title:String(fields.title),fragment:result.manageFragment},...(Array.isArray(previous)?previous:[])].slice(0,30)));}catch{/* The downloadable link remains available when storage is disabled. */}
  }catch(err){setError(err instanceof Error?err.message:'Opslaan mislukt.');if(uploadPath)void fetch('/api/visitor-event-photo',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:uploadPath})});submitLock.current=false;}finally{setBusy(false);}
 }
 const manageUrl=fragment?'/mijn-vermelding#'+fragment:'';
 return <main className={'owner-management '+s.page}>
  <nav className={s.links}><a href="/mijn-vermelding"><T>← Mijn vermelding</T></a><a href="/#gemeenten"><T>Naar de gemeentegids →</T></a></nav>
  <p className="section-kicker"><T>Voor winkels en dienstverleners</T></p><h1><T>Bedrijf aanmelden in de gemeentegids</T></h1>
  {fragment?<section role="status" className={s.success}>
   <h2><T>Je bedrijfsvermelding is ontvangen.</T></h2><p><strong>{title}</strong></p><p><T>De beheerder controleert je aanmelding voordat deze in de gemeentegids verschijnt. Je kunt je gegevens en foto nu al beheren.</T></p>
   <p><T>Bewaar je persoonlijke beheerlink als een wachtwoord. Deze geeft toegang tot jouw gegevens, advertenties en betalingen.</T></p>
   <p><T>Na goedkeuring ontvang je ook een e-mail met je persoonlijke beheerlink.</T></p>
   <div className={s.links}><a className={s.primary} href={manageUrl}><T>Mijn vermelding beheren →</T></a><a href={'/mijn-vermelding?upgrade=1#'+fragment}><T>Optioneel: advertentie kiezen →</T></a></div>
   <div className={s.links}><button type="button" onClick={()=>void navigator.clipboard.writeText(window.location.origin+manageUrl).then(()=>setCopied(true)).catch(()=>setError('Kopiëren lukt niet. Bewaar je beheerlink als bestand.'))}><T>{copied?'Beheerlink gekopieerd.':'Beheerlink kopiëren'}</T></button><a download="Cote-de-Duras-beheerlink.txt" href={'data:text/plain;charset=utf-8,'+encodeURIComponent(window.location.origin+manageUrl)}><T>Beheerlink bewaren als bestand</T></a></div>
  </section>:<>
   <p><T>Meld je winkel of dienstverlening gratis aan. Je vermelding krijgt een vaste plek in de gemeentegids, zonder evenementdatum. Na het aanmelden kun je via Mijn vermelding ook een betaalde advertentie kiezen.</T></p>
   <p><T>Staat je bedrijf al in de gids? Zoek het eerst via Mijn vermelding en vraag beheer aan om een dubbele vermelding te voorkomen.</T> <a href="/mijn-vermelding"><T>Mijn bedrijf zoeken →</T></a></p>
   <form onSubmit={submit} className={s.form}>
    <fieldset disabled={busy}><legend><T>Bedrijfsgegevens</T></legend><div className={s.grid}>
     <label><T>Je e-mailadres voor de beheerlink</T> *<input name="ownerEmail" type="email" required maxLength={254} autoComplete="email"/><small><T>Na goedkeuring ontvang je hier automatisch je persoonlijke beheerlink. Dit e-mailadres wordt niet openbaar getoond.</T></small></label>
     <label><T>Bedrijfsnaam</T> *<input name="title" required maxLength={250} autoComplete="organization"/></label>
     <label><T>Rubriek</T> *<select name="municipal_type" required defaultValue=""><option value="" disabled>{t('Kies een rubriek')}</option>{Object.entries(MUNICIPAL_BUSINESS_LABELS).sort((a,b)=>t(a[1]).localeCompare(t(b[1]),locale)).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
     <label><T>Adres</T> *<input name="address" required maxLength={250} autoComplete="street-address"/></label>
     <label><T>Postcode</T> *<input name="postcode" required pattern="[0-9]{5}" maxLength={5} inputMode="numeric" autoComplete="postal-code"/></label>
     <label><T>Gemeente</T> *<select name="municipal_code" required defaultValue=""><option value="" disabled>{t('Kies een gemeente')}</option>{[...areas.areas].sort((a,b)=>a.name.localeCompare(b.name,locale)).map(area=><option key={area.code_insee} value={area.code_insee}>{area.name}</option>)}</select></label>
     <label><T>Telefoon</T><input name="contact_phone" type="tel" maxLength={250} autoComplete="tel"/></label>
     <label><T>Zakelijk e-mailadres</T><input name="municipal_email" type="email" maxLength={250} autoComplete="email"/><small><T>Dit contactadres wordt bij je bedrijf getoond.</T></small></label>
     <label><T>Website</T><input name="website_url" maxLength={1000} inputMode="url" autoComplete="url" placeholder="https://"/></label>
    </div>
    <label><T>Openingstijden</T><textarea name="municipal_hours" maxLength={1000} rows={3}/></label>
    <label><T>Korte omschrijving</T><input name="short_description" maxLength={250}/></label>
    <label><T>Beschrijving</T><textarea name="description" maxLength={12000} rows={5}/></label>
    <label><T>Foto van je bedrijf (optioneel)</T><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0]||null)}/><small><T>Gebruik een eigen foto of een foto waarvoor je toestemming hebt. JPG, PNG of WebP.</T></small></label>
    {preview&&<img className={s.photo} src={preview} alt={t('Voorvertoning van je bedrijfsfoto')}/>}
    <label className={s.consent}><input type="checkbox" required/><span><T>Ik ben bevoegd om dit bedrijf aan te melden en de opgegeven gegevens en foto te gebruiken.</T></span></label>
    <button type="submit" className={s.primary}><T>{busy?'Aanmelding opslaan…':'Gratis bedrijfsvermelding aanmelden'}</T></button>
    </fieldset>
   </form>
  </>}
  {error&&<p role="alert" className={s.error}><T>{error}</T></p>}
 </main>;
}
