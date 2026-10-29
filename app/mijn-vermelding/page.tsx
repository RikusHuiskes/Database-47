"use client";
import {useEffect,useState} from 'react';
import {prepareEventPhoto} from '../../lib/event-photo-browser';
type Access={id:string;token:string};
type SavedLink={title:string;fragment:string};
export default function MyListing(){
  const [access,setAccess]=useState<Access|null>(null),[event,setEvent]=useState<Record<string,unknown>|null>(null),[category,setCategory]=useState(''),[categories,setCategories]=useState<{id:string;name:string}[]>([]),[savedLinks,setSavedLinks]=useState<SavedLink[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[link,setLink]=useState(''),[photo,setPhoto]=useState<File|null>(null),[ad,setAd]=useState<{amount_cents:number;payment_status:string;starts_on:string;ends_on:string}|null>(null);
  const [paymentReady,setPaymentReady]=useState(false);
  useEffect(()=>{void fetch('/api/advertising-config').then(r=>r.json()).then(data=>setPaymentReady(data.configured===true)).catch(()=>{});},[]);
  useEffect(()=>{
    try{setSavedLinks(JSON.parse(localStorage.getItem('cdd-managed-links')??'[]'));}catch{}
    const fragment=window.location.hash.slice(1)||sessionStorage.getItem('cdd-management-session')||'';
    const match=fragment.match(/^([a-f0-9-]{36}):([A-Za-z0-9_-]{43})$/i);
    if(match){setAccess({id:match[1],token:match[2]});sessionStorage.setItem('cdd-management-session',fragment);window.history.replaceState(null,'',window.location.pathname);}
  },[]);
  useEffect(()=>{
    if(!access)return;let active=true;setBusy(true);setMessage('');
    void fetch('/api/managed-event?id='+access.id,{headers:{Authorization:'Bearer '+access.token},cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);if(active){setEvent(data.event);setCategory(data.categoryId);setCategories(data.categories??[]);setAd(data.advertising);}}).catch(error=>{if(active)setMessage(error.message);}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[access]);
  const change=(key:string,value:unknown)=>setEvent(previous=>previous?{...previous,[key]:value}:null);
  function openLink(value:string){const fragment=value.includes('#')?value.split('#')[1]:value;const match=fragment.match(/^([a-f0-9-]{36}):([A-Za-z0-9_-]{43})$/i);if(match){setAccess({id:match[1],token:match[2]});sessionStorage.setItem('cdd-management-session',fragment);setEvent(null);}else setMessage('Plak je volledige persoonlijke beheerlink.');}
  async function save(e:React.FormEvent){
    e.preventDefault();if(!access||!event)return;setBusy(true);setMessage('');let path:string|null=null,complete=false;
    try{
      const payload={...event};
      if(photo){if(photo.size>5*1024*1024)throw Error('De foto mag maximaal 5 MB zijn.');const form=new FormData();form.set('photo',await prepareEventPhoto(photo));const response=await fetch('/api/visitor-event-photo',{method:'POST',body:form});const data=await response.json();if(!response.ok)throw Error(data.error);payload.image_url=data.imageUrl;path=data.path;}
      const response=await fetch('/api/managed-event',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({id:access.id,event:payload,categoryId:category})});const data=await response.json();if(!response.ok)throw Error(data.error);complete=true;setEvent(payload);setPhoto(null);setMessage('Je wijzigingen zijn opgeslagen. De bestaande goedkeuringsstatus en advertentieafspraken zijn behouden.');
    }catch(error){setMessage(error instanceof Error?error.message:'Opslaan mislukt.');}
    finally{if(path&&!complete)await fetch('/api/visitor-event-photo',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})}).catch(()=>{});setBusy(false);}
  }
  async function checkout(){if(!access)return;setBusy(true);try{const response=await fetch('/api/mollie/checkout',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({eventId:access.id})});const data=await response.json();if(!response.ok)throw Error(data.error);window.location.assign(data.checkoutUrl);}catch(error){setMessage(error instanceof Error?error.message:'Betaling niet beschikbaar.');setBusy(false);}}
  const field=(key:string,label:string,type='text',required=false)=><label key={key}>{label}{required?' *':''}<input type={type} required={required} value={String(event?.[key]??'')} onChange={e=>change(key,e.target.value)}/></label>;
  const localDate=(value:unknown)=>{if(!value)return '';const date=new Date(String(value));return Number.isFinite(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';};
  return <main className="region-introduction owner-management"><nav><a href="/">← Côte de Duras</a><a href="/#agenda">Agenda</a></nav><h1>Mijn evenement/vermelding wijzigen</h1><p>Gebruik de persoonlijke beheerlink die je na invoer hebt ontvangen. Bewaar deze als een wachtwoord: iedereen met de link kan deze vermelding wijzigen.</p>
    {!access&&<><form onSubmit={e=>{e.preventDefault();openLink(link);}}><label>Persoonlijke beheerlink<input value={link} onChange={e=>setLink(e.target.value)} required autoComplete="off"/></label><button type="submit">Open mijn vermelding</button></form>{savedLinks.length>0&&<section><h2>Op dit apparaat bewaarde vermeldingen</h2>{savedLinks.map(item=><p key={item.fragment}><button type="button" onClick={()=>openLink(item.fragment)}>{item.title}</button></p>)}</section>}<p>Voor eerder ingevoerde vermeldingen zonder beheerlink kan de beheerder een persoonlijke link verstrekken.</p></>}
    {busy&&<p role="status">Even geduld…</p>}{message&&<p role="status">{message}</p>}
    {event&&<><form className="owner-form" onSubmit={save}>{field('title','Titel','text',true)}{field('short_description','Korte omschrijving')}<label>Beschrijving<textarea value={String(event.description??'')} onChange={e=>change('description',e.target.value)} rows={7}/></label><label>Categorie<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Nog niet ingedeeld</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {!event.is_directory_entry&&<><label>Begindatum en tijd *<input type="datetime-local" required value={localDate(event.start_at)} onChange={e=>change('start_at',e.target.value?new Date(e.target.value).toISOString():null)}/></label><label>Einddatum en tijd<input type="datetime-local" value={localDate(event.end_at)} onChange={e=>change('end_at',e.target.value?new Date(e.target.value).toISOString():null)}/></label></>}
      {field('venue_name','Locatie / zaal')}{field('address','Adres')}{field('postcode','Postcode')}{field('city','Plaats','text',true)}{field('contact_phone','Telefoon','tel')}{field('website_url','Website','text',true)}{field('booking_url','Reserveringslink','text',true)}{field('source_url','Informatiebron','text',true)}
      <label><input type="checkbox" checked={event.is_free===true} onChange={e=>change('is_free',e.target.checked)}/> Gratis activiteit</label>{!event.is_free&&<>{field('price_from','Prijs vanaf (€)','number')}{field('price_to','Prijs tot (€)','number')}</>}
      {typeof event.image_url==='string'&&<img className="owner-photo" src={event.image_url} alt="Huidige foto"/>}<label>Foto vervangen (JPG, PNG, WebP, maximaal 5 MB)<input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e=>setPhoto(e.target.files?.[0]??null)}/></label><button type="submit" disabled={busy}>Wijzigingen opslaan</button></form>
      {ad&&<section><h2>Advertentieaanvraag</h2><p>Periode: {ad.starts_on} tot {ad.ends_on}. Bedrag: €{(ad.amount_cents/100).toFixed(2).replace('.',',')}. Betaalstatus: {ad.payment_status}.</p>{ad.payment_status!=='paid'&&<button type="button" disabled={busy||!paymentReady} onClick={()=>void checkout()}>Betalen via Mollie</button>}<p>Côte de Duras · 1049 Route du Nourissat · 47120 Savignac de Duras · SIRET 93451899400025. De getoonde bedragen zijn de te betalen bedragen.</p>{!paymentReady&&<p>Online betalen wordt binnenkort beschikbaar. Je aanvraag is opgeslagen.</p>}<p>Een advertentie verschijnt na goedkeuring en betaalbevestiging, uitsluitend in de afgesproken periode.</p></section>}
      <p><button type="button" onClick={()=>{setAccess(null);setEvent(null);sessionStorage.removeItem('cdd-management-session');}}>Andere vermelding openen</button></p></>}
  </main>;
}
