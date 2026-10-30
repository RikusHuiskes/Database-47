"use client";
import {useEffect,useRef,useState} from 'react';
import {prepareEventPhoto} from '../../lib/event-photo-browser';
import {eventPhotoType} from '../../lib/event-photo';
type Access={id:string;token:string};
type SavedLink={title:string;fragment:string};
async function checkedPaymentStatus(access:Access){
 const response=await fetch('/api/mollie/status',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({eventId:access.id}),cache:'no-store'});
 const data=await response.json();if(!response.ok)throw Error(data.error);return String(data.paymentStatus);
}
export default function MyListing(){
  const [access,setAccess]=useState<Access|null>(null),[event,setEvent]=useState<Record<string,unknown>|null>(null),[category,setCategory]=useState(''),[categories,setCategories]=useState<{id:string;name:string}[]>([]),[savedLinks,setSavedLinks]=useState<SavedLink[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[link,setLink]=useState(''),[photo,setPhoto]=useState<File|null>(null),[ad,setAd]=useState<{amount_cents:number;payment_status:string;starts_on:string;ends_on:string}|null>(null);
  const [paymentReady,setPaymentReady]=useState(false);
  const [saving,setSaving]=useState(false);
  const [photoPreview,setPhotoPreview]=useState(''),[photoError,setPhotoError]=useState('');
  const photoInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!photo){setPhotoPreview('');if(photoInput.current)photoInput.current.value='';return;}
    const url=URL.createObjectURL(photo);setPhotoPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[photo]);
  useEffect(()=>{setPhoto(null);setPhotoError('');},[access?.id]);
  function choosePhoto(file:File|null){
    setPhotoError('');
    if(file&&(!eventPhotoType(file)||file.size===0||file.size>5*1024*1024)){
      setPhoto(null);if(photoInput.current)photoInput.current.value='';
      setPhotoError('Kies een JPG-, PNG- of WebP-foto van maximaal 5 MB.');return;
    }
    setPhoto(file);
  }
  const [recoveryEmail,setRecoveryEmail]=useState(''),[recoveryTitle,setRecoveryTitle]=useState(''),[recoveryCity,setRecoveryCity]=useState('');
  useEffect(()=>{void fetch('/api/advertising-config').then(r=>r.json()).then(data=>setPaymentReady(data.configured===true)).catch(()=>{});},[]);
  useEffect(()=>{
    try{setSavedLinks(JSON.parse(localStorage.getItem('cdd-managed-links')??'[]'));}catch{}
    const fragment=window.location.hash.slice(1)||sessionStorage.getItem('cdd-management-session')||'';
    const match=fragment.match(/^([a-f0-9-]{36}):([A-Za-z0-9_-]{43})$/i);
    if(match){setAccess({id:match[1],token:match[2]});sessionStorage.setItem('cdd-management-session',fragment);window.history.replaceState(null,'',window.location.pathname);}
  },[]);
  useEffect(()=>{
    if(!access)return;let active=true;setBusy(true);setMessage('');
    void fetch('/api/managed-event?id='+access.id,{headers:{Authorization:'Bearer '+access.token},cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);if(active){setEvent(data.event);setCategory(data.categoryId);setCategories(data.categories??[]);setAd(data.advertising);}
      if(data.advertising?.payment_status==='open'){
        try{const status=await checkedPaymentStatus(access);if(active){setAd(previous=>previous?{...previous,payment_status:status}:null);if(status==='paid')setMessage('Je betaling is bevestigd. De vermelding wacht zo nodig nog op goedkeuring.');}}
        catch(error){if(active)setMessage(error instanceof Error?error.message:'De betaalstatus kon niet worden gecontroleerd.');}
      }
    }).catch(error=>{if(active)setMessage(error.message);}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[access]);
  const change=(key:string,value:unknown)=>setEvent(previous=>previous?{...previous,[key]:value}:null);
  function openLink(value:string){const fragment=value.includes('#')?value.split('#')[1]:value;const match=fragment.match(/^([a-f0-9-]{36}):([A-Za-z0-9_-]{43})$/i);if(match){setAccess({id:match[1],token:match[2]});sessionStorage.setItem('cdd-management-session',fragment);setEvent(null);}else setMessage('Plak je volledige persoonlijke beheerlink.');}
  async function save(e:React.FormEvent){
    e.preventDefault();if(!access||!event)return;setBusy(true);setSaving(true);setMessage('');let path:string|null=null,complete=false;
    try{
      const payload={...event};
      if(photo){if(photo.size>5*1024*1024)throw Error('De foto mag maximaal 5 MB zijn.');const form=new FormData();form.set('photo',await prepareEventPhoto(photo));const response=await fetch('/api/visitor-event-photo',{method:'POST',body:form});const data=await response.json();if(!response.ok)throw Error(data.error);payload.image_url=data.imageUrl;path=data.path;}
      const response=await fetch('/api/managed-event',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({id:access.id,event:payload,categoryId:category})});const data=await response.json();if(!response.ok)throw Error(data.error);complete=true;setEvent(payload);setPhoto(null);setMessage('Je wijzigingen zijn opgeslagen. De bestaande goedkeuringsstatus en advertentieafspraken zijn behouden.');
    }catch(error){setMessage(error instanceof Error?error.message:'Opslaan mislukt.');}
    finally{if(path&&!complete)await fetch('/api/visitor-event-photo',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})}).catch(()=>{});setBusy(false);setSaving(false);}
  }
  async function checkout(){if(!access)return;setBusy(true);try{const response=await fetch('/api/mollie/checkout',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({eventId:access.id})});const data=await response.json();if(!response.ok)throw Error(data.error);window.location.assign(data.checkoutUrl);}catch(error){setMessage(error instanceof Error?error.message:'Betaling niet beschikbaar.');setBusy(false);}}
  async function refreshPayment(){if(!access)return;setBusy(true);setMessage('');try{const status=await checkedPaymentStatus(access);setAd(previous=>previous?{...previous,payment_status:status}:null);setMessage(status==='paid'?'Je betaling is bevestigd. De vermelding wacht zo nodig nog op goedkeuring.':'De betaalstatus is gecontroleerd.');}catch(error){setMessage(error instanceof Error?error.message:'De betaalstatus kon niet worden gecontroleerd.');}finally{setBusy(false);}}
  const field=(key:string,label:string,type='text',required=false)=><label key={key}>{label}{required?' *':''}<input type={type} required={required} value={String(event?.[key]??'')} onChange={e=>change(key,e.target.value)}/></label>;
  const localDate=(value:unknown)=>{if(!value)return '';const date=new Date(String(value));return Number.isFinite(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';};
  return <main className="region-introduction owner-management"><nav><a href="/">← Côte de Duras</a><a href="/#agenda">Agenda</a><a href="/handleiding#wijzigen">Hulp bij je vermelding</a></nav><h1>Mijn vermelding beheren</h1>{!access&&<aside className="owner-recovery"><h2>Nog geen persoonlijke beheerlink?</h2><p>Zoek je vermelding in de agenda, open de details en kies Deze vermelding beheren. We controleren eerst of je namens de organisatie mag handelen. Zie je alleen een fout? Kies dan Correctie doorgeven. Een aanvraag geeft geen directe wijzigingsrechten.</p><a href="/#agenda">Zoek je vermelding in de agenda →</a></aside>}<p>Pas zelf de tekst, datum, contactgegevens en foto van je evenement of vermelding aan. Je hebt geen account nodig: gebruik je persoonlijke beheerlink. Bewaar deze als een wachtwoord.</p>
    {!access&&<>{savedLinks.length>0&&<section><h2>Op dit apparaat bewaarde vermeldingen</h2><p>Kies de vermelding die je wilt wijzigen. Deze lijst is alleen in deze browser beschikbaar.</p>{savedLinks.map(item=><p key={item.fragment}><button type="button" onClick={()=>openLink(item.fragment)}>{item.title}</button></p>)}</section>}<form className="owner-form" onSubmit={e=>{e.preventDefault();openLink(link);}}><label>Persoonlijke beheerlink<input value={link} onChange={e=>setLink(e.target.value)} required autoComplete="off" spellCheck={false}/></label><button type="submit">Open mijn vermelding</button></form><details className="owner-recovery"><summary>Beheerlink kwijt of nooit ontvangen?</summary><p>Controleer eerst je bewaarde links hierboven of het beheerlinkbestand dat je na het insturen hebt opgeslagen. Lukt dat niet? Vraag hulp aan de beheerder. Na controle of de vermelding van jou is, kun je een persoonlijke link ontvangen.</p><form className="owner-form" onSubmit={e=>{e.preventDefault();window.location.href='mailto:Info@cotededuras.com?subject='+encodeURIComponent('Beheerlink aanvragen: '+recoveryTitle)+'&body='+encodeURIComponent('Beste Côte de Duras,\n\nIk wil mijn eigen vermelding beheren, maar heb geen beheerlink meer.\n\nTitel: '+recoveryTitle+'\nPlaats: '+recoveryCity+'\nMijn oorspronkelijke contact-e-mailadres: '+recoveryEmail+'\n\nGraag ontvang ik hulp bij het herstellen van mijn toegang.');}}><label>Titel van je vermelding<input required maxLength={200} value={recoveryTitle} onChange={e=>setRecoveryTitle(e.target.value)}/></label><label>Plaats<input required maxLength={120} value={recoveryCity} onChange={e=>setRecoveryCity(e.target.value)}/></label><label>Oorspronkelijk contact-e-mailadres<input required type="email" autoComplete="email" value={recoveryEmail} onChange={e=>setRecoveryEmail(e.target.value)}/></label><button type="submit">E-mail met herstelverzoek opstellen</button></form><p>Je e-mailprogramma opent met een concept. Verstuur het verzoek daar zelf naar <a href="mailto:Info@cotededuras.com">Info@cotededuras.com</a>. Automatisch herstel per e-mail is nog niet beschikbaar. Deel je persoonlijke beheerlink niet.</p></details></>}
    {!event&&<>{busy&&<p role="status">Even geduld…</p>}{message&&<p role="status">{message}</p>}</>}
    {event&&<><form className="owner-form" onSubmit={save}>{field('title','Titel','text',true)}{field('short_description','Korte omschrijving')}<label>Beschrijving<textarea value={String(event.description??'')} onChange={e=>change('description',e.target.value)} rows={7}/></label><label>Categorie<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Nog niet ingedeeld</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {!event.is_directory_entry&&<><label>Begindatum en tijd *<input type="datetime-local" required value={localDate(event.start_at)} onChange={e=>change('start_at',e.target.value?new Date(e.target.value).toISOString():null)}/></label><label>Einddatum en tijd<input type="datetime-local" value={localDate(event.end_at)} onChange={e=>change('end_at',e.target.value?new Date(e.target.value).toISOString():null)}/></label></>}
      {field('venue_name','Locatie / zaal')}{field('address','Adres')}{field('postcode','Postcode')}{field('city','Plaats','text',true)}{field('contact_phone','Telefoon','tel')}{field('website_url','Website')}{field('booking_url','Reserveringslink')}{event.is_manual_entry?field('source_url','Informatiebron','text',true):<label>Oorspronkelijke informatiebron (blijft behouden)<input readOnly value={String(event.source_url??'')}/></label>}
      <label><input type="checkbox" checked={event.is_free===true} onChange={e=>change('is_free',e.target.checked)}/> Gratis activiteit</label>{!event.is_free&&<>{field('price_from','Prijs vanaf (€)','number')}{field('price_to','Prijs tot (€)','number')}</>}
      {!photoPreview&&typeof event.image_url==='string'&&event.image_url&&<figure className="owner-photo-preview"><img className="owner-photo" src={event.image_url} alt="Opgeslagen foto van je vermelding"/><figcaption>Huidige opgeslagen foto</figcaption></figure>}
      <label>Foto vervangen (JPG, PNG, WebP, maximaal 5 MB)<input ref={photoInput} disabled={busy} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e=>choosePhoto(e.target.files?.[0]??null)}/></label>
      {photoError&&<p role="alert">{photoError}</p>}
      {photoPreview&&<figure className="owner-photo-preview"><img className="owner-photo" src={photoPreview} alt="Voorbeeld van de gekozen nieuwe foto" onError={()=>setPhotoError('Deze foto kan niet worden getoond. Kies een andere JPG-, PNG- of WebP-foto.')}/><figcaption>Voorbeeld van je nieuwe foto — klik op ‘Wijzigingen opslaan’ om deze te plaatsen.</figcaption><button type="button" disabled={busy} onClick={()=>{setPhoto(null);setPhotoError('');}}>Gekozen foto annuleren</button></figure>}
      <button type="submit" disabled={busy||!!photoError} aria-describedby="owner-save-status">{saving?'Foto en wijzigingen worden opgeslagen…':'Wijzigingen opslaan'}</button>
      <div id="owner-save-status" role="status" aria-live="polite" aria-atomic="true">{saving?<p className="owner-save-message">Bezig met opslaan. Wacht tot de bevestiging verschijnt.</p>:message?<p className="owner-save-message">{message}</p>:null}</div></form>
      {ad&&<section><h2>Advertentieaanvraag</h2><p>Periode: {ad.starts_on} tot {ad.ends_on}. Bedrag: €{(ad.amount_cents/100).toFixed(2).replace('.',',')}. Betaalstatus: {ad.payment_status}.</p>{ad.payment_status!=='paid'&&<button type="button" disabled={busy||!paymentReady} onClick={()=>void checkout()}>Betalen via Mollie</button>}{ad.payment_status==='open'&&<button type="button" disabled={busy||!paymentReady} onClick={()=>void refreshPayment()}>Betaalstatus controleren</button>}<p>Côte de Duras · 1049 Route du Nourissat · 47120 Savignac de Duras · SIRET 93451899400025. De getoonde bedragen zijn de te betalen bedragen.</p>{!paymentReady&&<p>Online betalen wordt binnenkort beschikbaar. Je aanvraag is opgeslagen.</p>}<p>Een advertentie verschijnt na goedkeuring en betaalbevestiging, uitsluitend in de afgesproken periode.</p></section>}
      <p><button type="button" onClick={()=>{setAccess(null);setEvent(null);sessionStorage.removeItem('cdd-management-session');}}>Andere vermelding openen</button></p></>}
  </main>;
}
