"use client";
import MonthlySubscriptions from './MonthlySubscriptions';
import {T, A} from '../i18n/Language';

import {useEffect,useRef,useState} from 'react';
import {prepareEventPhoto} from '../../lib/event-photo-browser';
import {eventPhotoType} from '../../lib/event-photo';
import {MUNICIPAL_BUSINESS_LABELS} from '../../lib/municipal-shops';
import {advertisingOrderTypes,ADVERTISING_LABELS} from '../../lib/advertising';
import MunicipalManagementAccess from '../components/MunicipalManagementAccess';
import ListingRequestForm from '../components/ListingRequestForm';
import ListingFinder from './ListingFinder';
import AdvertisingUpgrade,{type OwnerAdvertisement} from './AdvertisingUpgrade';
import {managementFragment,matchingManagementLink,managementDestination,canResumeAdvertisement,advertisementPaymentLabel,type ManagementTarget,type OwnerSection} from '../../lib/management-navigation';
type Access={id:string;token:string};
type SavedLink={title:string;fragment:string};
type PaymentReturnStatus='checking'|'paid'|'open'|'not-paid'|'not-found'|'no-access'|'unknown';
type PaymentReturn={requestId:string;status:PaymentReturnStatus};
async function checkedPaymentStatus(access:Access,requestId?:string){
 const response=await fetch('/api/mollie/status',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({eventId:access.id,requestId}),cache:'no-store'});
 const data=await response.json();if(!response.ok)throw Error(data.error);return String(data.paymentStatus);
}
export default function MyListing(){
  const [access,setAccess]=useState<Access|null>(null),[event,setEvent]=useState<Record<string,unknown>|null>(null),[category,setCategory]=useState(''),[categories,setCategories]=useState<{id:string;name:string}[]>([]),[savedLinks,setSavedLinks]=useState<SavedLink[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[link,setLink]=useState(''),[photo,setPhoto]=useState<File|null>(null),[ad,setAd]=useState<OwnerAdvertisement|null>(null);
  const [advertisements,setAdvertisements]=useState<OwnerAdvertisement[]>([]);
  const [paymentReady,setPaymentReady]=useState(false);
  const [paymentReturn,setPaymentReturn]=useState<PaymentReturn|null>(null);
  const [saving,setSaving]=useState(false);
  const [section,setSection]=useState<OwnerSection>('edit'),[entrySection,setEntrySection]=useState<'link'|'search'|'help'>('link');
  const [upgradeTarget,setUpgradeTarget]=useState<ManagementTarget|null>(null);
  const [photoPreview,setPhotoPreview]=useState(''),[photoError,setPhotoError]=useState('');
  const photoInput=useRef<HTMLInputElement>(null);
  const paymentReturnRequestId=paymentReturn?.requestId;
  const isPaymentReturn=paymentReturn!==null;
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
    let saved:SavedLink[]=[];try{const stored=JSON.parse(localStorage.getItem('cdd-managed-links')??'[]');if(Array.isArray(stored)){saved=stored;setSavedLinks(stored);}}catch{}
    const params=new URLSearchParams(window.location.search),returningFromPayment=params.get('betaling')==='terug',requestId=(params.get('aanvraag')??'').slice(0,36);
    if(returningFromPayment)setPaymentReturn({requestId,status:'checking'});
    const destination=managementDestination(params),target=destination.target;
    setUpgradeTarget(target);setSection(destination.section);
    if(target)setEntrySection(params.get('upgrade')==='1'?'link':'search');
    const hash=managementFragment(window.location.hash.slice(1)),session=sessionStorage.getItem('cdd-management-session');
    const found=target?.id?(hash?.id===target.id?hash:matchingManagementLink(target.id,saved,session)):(hash||managementFragment(session));
    if(found){setAccess({id:found.id,token:found.token});sessionStorage.setItem('cdd-management-session',found.fragment);window.history.replaceState(null,'',window.location.pathname+window.location.search);}
    else if(returningFromPayment)setPaymentReturn({requestId,status:'no-access'});
  },[]);
  useEffect(()=>{
    if(!access)return;let active=true;setBusy(true);setMessage('');
    void fetch('/api/managed-event?id='+access.id,{headers:{Authorization:'Bearer '+access.token},cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);if(!active)return;if(upgradeTarget?.serviceId&&data.event?.municipal_key!==upgradeTarget.serviceId)throw Error('Deze beheerlink hoort bij een andere vermelding. Kies de juiste beheerlink.');const orders:OwnerAdvertisement[]=data.advertisements??(data.advertising?[data.advertising]:[]);setEvent(data.event);setCategory(data.categoryId);setCategories(data.categories??[]);setAd(data.advertising);setAdvertisements(orders);
      if(isPaymentReturn){
        const returnedOrder=paymentReturnRequestId?orders.find(item=>item.id===paymentReturnRequestId):orders[0];
        if(!returnedOrder){setPaymentReturn(previous=>previous?{...previous,status:'not-found'}:previous);return;}
        try{const status=await checkedPaymentStatus(access,returnedOrder.id);if(active){const viewStatus:PaymentReturnStatus=status==='paid'?'paid':status==='open'?'open':'not-paid';setAd(previous=>previous?.id===returnedOrder.id?{...previous,payment_status:status}:previous);setAdvertisements(previous=>previous.map(item=>item.id===returnedOrder.id?{...item,payment_status:status}:item));setPaymentReturn(previous=>previous?{...previous,status:viewStatus}:previous);}}
        catch{if(active)setPaymentReturn(previous=>previous?{...previous,status:'unknown'}:previous);}
        return;
      }
      for(const pendingOrder of orders.filter(item=>item.payment_status==='open')){
        try{const status=await checkedPaymentStatus(access,pendingOrder.id);if(active){setAd(previous=>previous?.id===pendingOrder.id?{...previous,payment_status:status}:previous);setAdvertisements(previous=>previous.map(item=>item.id===pendingOrder.id?{...item,payment_status:status}:item));if(status==='paid')setMessage('Je betaling is bevestigd. De vermelding wacht zo nodig nog op goedkeuring.');}}
        catch(error){if(active)setMessage(error instanceof Error?error.message:'De betaalstatus kon niet worden gecontroleerd.');}
      }
    }).catch(error=>{if(active){if(isPaymentReturn)setPaymentReturn(previous=>previous?{...previous,status:'unknown'}:previous);else {setMessage(error.message);setBusy(false);setAccess(null);setEvent(null);setEntrySection('link');}}}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[access,paymentReturnRequestId,isPaymentReturn,upgradeTarget?.serviceId]);
  const change=(key:string,value:unknown)=>setEvent(previous=>previous?{...previous,[key]:value}:null);
  function openLink(value:string){const found=managementFragment(value);if(found&&upgradeTarget?.id&&found.id!==upgradeTarget.id){setMessage('Deze beheerlink hoort bij een andere vermelding. Gebruik de link voor ‘'+upgradeTarget.title+'’.');return;}if(found){setAccess({id:found.id,token:found.token});sessionStorage.setItem('cdd-management-session',found.fragment);setEvent(null);}else setMessage('Plak je volledige persoonlijke beheerlink.');}
  async function save(e:React.FormEvent){
    e.preventDefault();if(!access||!event)return;setBusy(true);setSaving(true);setMessage('');let path:string|null=null,complete=false;
    try{
      const payload={...event};
      if(photo){if(photo.size>5*1024*1024)throw Error('De foto mag maximaal 5 MB zijn.');const form=new FormData();form.set('photo',await prepareEventPhoto(photo));const response=await fetch('/api/visitor-event-photo',{method:'POST',body:form});const data=await response.json();if(!response.ok)throw Error(data.error);payload.image_url=data.imageUrl;path=data.path;}
      const response=await fetch('/api/managed-event',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({id:access.id,event:payload,categoryId:category})});const data=await response.json();if(!response.ok)throw Error(data.error);complete=true;setEvent({...payload,status:"pending",verified:false});setPhoto(null);setMessage('Je wijzigingen zijn opgeslagen en wachten op controle. De beheerder is geïnformeerd. Je advertentieafspraken en betaalhistorie blijven behouden.');
    }catch(error){setMessage(error instanceof Error?error.message:'Opslaan mislukt.');}
    finally{if(path&&!complete)await fetch('/api/visitor-event-photo',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})}).catch(()=>{});setBusy(false);setSaving(false);}
  }
  async function checkout(requestId?:string){if(!access)return;setBusy(true);try{const response=await fetch('/api/mollie/checkout',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({eventId:access.id,requestId})});const data=await response.json();if(!response.ok)throw Error(data.error);window.location.assign(data.checkoutUrl);}catch(error){setMessage(error instanceof Error?error.message:'Betaling niet beschikbaar.');setBusy(false);}}
  async function refreshPayment(requestId:string){if(!access)return;setBusy(true);setMessage('');try{const status=await checkedPaymentStatus(access,requestId);setAd(previous=>previous?.id===requestId?{...previous,payment_status:status}:previous);setAdvertisements(previous=>previous.map(item=>item.id===requestId?{...item,payment_status:status}:item));setMessage(status==='paid'?'Je betaling is bevestigd. De vermelding wacht zo nodig nog op goedkeuring.':'De betaalstatus is gecontroleerd.');}catch(error){setMessage(error instanceof Error?error.message:'De betaalstatus kon niet worden gecontroleerd.');}finally{setBusy(false);}}
  async function refreshPaymentReturn(){if(!access||!paymentReturn)return;setBusy(true);setPaymentReturn(previous=>previous?{...previous,status:'checking'}:previous);try{const status=await checkedPaymentStatus(access,paymentReturn.requestId||undefined);setPaymentReturn(previous=>previous?{...previous,status:status==='paid'?'paid':status==='open'?'open':'not-paid'}:previous);}catch{setPaymentReturn(previous=>previous?{...previous,status:'unknown'}:previous);}finally{setBusy(false);}}
  const field=(key:string,label:string,type='text',required=false)=><label key={key}><T>{label}</T><T>{required?' *':''}</T><input type={type} required={required} value={String(event?.[key]??'')} onChange={e=>change(key,e.target.value)}/></label>;
  const localDate=(value:unknown)=>{if(!value)return '';const date=new Date(String(value));return Number.isFinite(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';};
  return <main className="region-introduction owner-management"><nav><a href="/"><T>{"← Côte de Duras"}</T></a><a href="/#agenda"><T>{"Agenda"}</T></a><a href="/handleiding#wijzigen"><T>{"Hulp bij je vermelding"}</T></a></nav><h1><T>{paymentReturn?'Betalingsbevestiging':'Vermelding toevoegen of beheren'}</T></h1>{paymentReturn?<section className="payment-return" aria-live="polite">
      <T>{paymentReturn.status==='checking'&&<><h2><T>{"Je betaling wordt gecontroleerd"}</T></h2><p><T>{"We controleren je betaling rechtstreeks bij Mollie. Dit kan een paar seconden duren."}</T></p></>}</T>
      <T>{paymentReturn.status==='paid'&&<><h2><T>{"Bedankt voor je bestelling en betaling"}</T></h2><p><T>{"Je betaling is bevestigd. Je advertentie wordt na goedkeuring geplaatst voor de afgesproken periode."}</T></p><p><T>{"Je kunt dit tabblad sluiten of teruggaan naar de website."}</T></p></>}</T>
      <T>{paymentReturn.status==='open'&&<><h2><T>{"Bedankt voor je bestelling"}</T></h2><p><T>{"Mollie heeft de betaling nog niet bevestigd. Je aanvraag blijft bewaard; controleer de betaalstatus zo opnieuw."}</T></p><button type="button" disabled={busy} onClick={()=>void refreshPaymentReturn()}><T>{busy?'Controleren…':'Betaalstatus opnieuw controleren'}</T></button></>}</T>
      <T>{paymentReturn.status==='not-paid'&&<><h2><T>{"De betaling is niet afgerond"}</T></h2><p><T>{"De advertentie wordt pas geplaatst nadat Mollie de betaling heeft bevestigd. Je kunt je persoonlijke beheerlink gebruiken om de betaling opnieuw te openen."}</T></p></>}</T>
      <T>{paymentReturn.status==='not-found'&&<><h2><T>{"Aanvraag niet gevonden"}</T></h2><p><T>{"We konden de betaalde advertentieaanvraag niet aan deze vermelding koppelen. Open je persoonlijke beheerlink om de status te bekijken."}</T></p></>}</T>
      <T>{paymentReturn.status==='no-access'&&<><h2><T>{"Bedankt voor je bestelling"}</T></h2><p><T>{"De betaling wordt niet automatisch getoond omdat deze browser je persoonlijke beheerlink niet heeft. Open die link om de status veilig te controleren."}</T></p></>}</T>
      <T>{paymentReturn.status==='unknown'&&<><h2><T>{"Je betaling wordt nog verwerkt"}</T></h2><p><T>{"We kunnen de status op dit moment niet ophalen. Probeer het opnieuw via je persoonlijke beheerlink; je bestelling blijft bewaard."}</T></p><T>{access&&<button type="button" disabled={busy} onClick={()=>void refreshPaymentReturn()}><T>{busy?'Controleren…':'Opnieuw controleren'}</T></button>}</T></>}</T>
      <p className="payment-return-actions"><a href="/mijn-vermelding?onderdeel=betalingen"><T>Mijn betalingen bekijken</T></a><a href="/#agenda"><T>{"Terug naar Côte de Duras"}</T></a><T>{paymentReturn.status==='no-access'&&<a href="/mijn-vermelding"><T>{"Mijn vermelding openen"}</T></a>}</T></p>
    </section>:<>
    <section className="owner-start-options" aria-labelledby="new-listing-heading"><h2 id="new-listing-heading"><T>Nieuwe vermelding toevoegen</T></h2><div><a href="/evenement/nieuw"><strong><T>Evenement of activiteit</T></strong><span><T>Voor de evenementenkalender →</T></span></a><a href="/gemeentegids/aanmelden"><strong><T>Winkel of dienstverlening</T></strong><span><T>Voor de gemeentegids →</T></span></a></div></section>
    <h2 id="bestaande-vermelding"><T>Bestaande vermelding beheren</T></h2>
    <p className="intro-lead"><T>Alles voor je vermelding op één plek: gegevens en foto wijzigen, adverteren, betalingen bekijken en hulp bij je beheerlink.</T></p>
    {!access&&<>
      <A><nav className="owner-hub-nav" aria-label="Mijn vermelding"><button type="button" aria-pressed={entrySection==='link'} onClick={()=>setEntrySection('link')}><T>Beheerlink openen</T></button><button type="button" aria-pressed={entrySection==='search'} onClick={()=>setEntrySection('search')}><T>Zoeken & aanvragen</T></button><button type="button" aria-pressed={entrySection==='help'} onClick={()=>setEntrySection('help')}><T>Beheerlink & hulp</T></button></nav></A>
      {upgradeTarget&&<aside className="owner-selected-listing"><small><T>Gekozen vermelding</T></small><strong><T>{upgradeTarget.title}</T></strong><p><T preserve>{upgradeTarget.city}</T></p><button type="button" onClick={()=>{setUpgradeTarget(null);setMessage('');setEntrySection('search');window.history.replaceState(null,'','/mijn-vermelding');}}><T>Andere vermelding zoeken</T></button></aside>}
      <div hidden={entrySection!=='search'}>
        {upgradeTarget?<><h2><T>Beheer of correctie aanvragen</T></h2>{upgradeTarget.serviceId&&upgradeTarget.city?<MunicipalManagementAccess key={upgradeTarget.serviceId} serviceId={upgradeTarget.serviceId} city={upgradeTarget.city} title={upgradeTarget.title}/>:<ListingRequestForm key={upgradeTarget.id} eventId={upgradeTarget.id} title={upgradeTarget.title}/>}</>:<ListingFinder onSelect={target=>{setUpgradeTarget(target);setMessage('');}}/>}
      </div>
    </>}
    <T>{!access&&<><div hidden={entrySection!=='link'}><h2><T>Open je persoonlijke beheeromgeving</T></h2><p><T>Gebruik de beheerlink uit je e-mail of de link die je bij het insturen hebt bewaard. Bewaar deze als een wachtwoord.</T></p><T>{savedLinks.length>0&&<section><h2><T>{"Op dit apparaat bewaarde vermeldingen"}</T></h2><p><T>{"Kies de vermelding die je wilt wijzigen. Deze lijst is alleen in deze browser beschikbaar."}</T></p><T>{savedLinks.filter(item=>!upgradeTarget?.id||managementFragment(item.fragment)?.id===upgradeTarget.id).map(item=><p key={item.fragment}><button type="button" onClick={()=>openLink(item.fragment)}><T>{item.title}</T></button></p>)}</T></section>}</T><form className="owner-form" onSubmit={e=>{e.preventDefault();openLink(link);}}><label><T>{"Persoonlijke beheerlink"}</T><input value={link} onChange={e=>setLink(e.target.value)} required autoComplete="off" spellCheck={false}/></label><button type="submit"><T>{'Open mijn vermelding'}</T></button></form><p><button type="button" onClick={()=>setEntrySection('search')}><T>Nog geen beheerlink? Zoek je vermelding</T></button></p></div><div hidden={entrySection!=='help'}><details open className="owner-recovery"><summary><T>{"Beheerlink kwijt of nooit ontvangen?"}</T></summary><p><T>{"Controleer eerst je bewaarde links hierboven of het beheerlinkbestand dat je na het insturen hebt opgeslagen. Lukt dat niet? Vraag hulp aan de beheerder. Na controle of de vermelding van jou is, kun je een persoonlijke link ontvangen."}</T></p><form className="owner-form" onSubmit={e=>{e.preventDefault();window.location.href='mailto:Info@cotededuras.com?subject='+encodeURIComponent('Beheerlink aanvragen: '+recoveryTitle)+'&body='+encodeURIComponent('Beste Côte de Duras,\n\nIk wil mijn eigen vermelding beheren, maar heb geen beheerlink meer.\n\nTitel: '+recoveryTitle+'\nPlaats: '+recoveryCity+'\nMijn oorspronkelijke contact-e-mailadres: '+recoveryEmail+'\n\nGraag ontvang ik hulp bij het herstellen van mijn toegang.');}}><label><T>{"Titel van je vermelding"}</T><input required maxLength={200} value={recoveryTitle} onChange={e=>setRecoveryTitle(e.target.value)}/></label><label><T>{"Plaats"}</T><input required maxLength={120} value={recoveryCity} onChange={e=>setRecoveryCity(e.target.value)}/></label><label><T>{"Oorspronkelijk contact-e-mailadres"}</T><input required type="email" autoComplete="email" value={recoveryEmail} onChange={e=>setRecoveryEmail(e.target.value)}/></label><button type="submit"><T>{"E-mail met herstelverzoek opstellen"}</T></button></form><p><T>{"Je e-mailprogramma opent met een concept. Verstuur het verzoek daar zelf naar "}</T><a href="mailto:Info@cotededuras.com"><T>{"Info@cotededuras.com"}</T></a><T>{". Automatisch herstel per e-mail is nog niet beschikbaar. Deel je persoonlijke beheerlink niet."}</T></p></details></div></>}</T>
    <T>{!event&&<><T>{busy&&<p role="status"><T>{"Even geduld…"}</T></p>}</T><T>{message&&<p role="status"><T>{message}</T></p>}</T></>}</T>
    <T>{event&&<>
      <aside className="owner-selected-listing"><small><T>{event.municipal_key?'Gemeentegids':'Evenementenkalender'}</T></small><strong><T>{String(event.title)}</T></strong><span><T preserve>{String(event.city??'')}</T></span></aside>
      <A><nav className="owner-hub-nav" aria-label="Beheer je vermelding">{([['edit','Gegevens wijzigen'],['advertise','Adverteren'],['payments','Betalingen'],['access','Beheerlink & hulp']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={section===key} onClick={()=>setSection(key)}><T>{label}</T></button>)}</nav></A>
      {message&&section!=='edit'&&<p className="owner-save-message" role="status"><T>{message}</T></p>}
      <div hidden={section!=='edit'}><h2><T>Gegevens wijzigen</T></h2><form className="owner-form" onSubmit={save}><T>{field('title','Titel','text',true)}</T><T>{field('short_description','Korte omschrijving')}</T><label><T>{"Beschrijving"}</T><textarea value={String(event.description??'')} onChange={e=>change('description',e.target.value)} rows={7}/></label><T>{!event.municipal_key&&<label><T>{"Categorie"}</T><select disabled={!!event.municipal_key} value={category} onChange={e=>setCategory(e.target.value)}><option value=""><T>{"Nog niet ingedeeld"}</T></option><T>{categories.map(c=><option key={c.id} value={c.id}><T>{c.name}</T></option>)}</T></select></label>}</T>
      <T>{event.municipal_key&&<p><strong><T>{"Gemeentegids · "}</T><T>{MUNICIPAL_BUSINESS_LABELS[String(event.municipal_type)]||String(event.municipal_type)}</T><T>{" · "}</T><T>{String(event.city)}</T></strong></p>}</T>
      <T>{!event.is_directory_entry&&<><label><T>{"Begindatum en tijd *"}</T><input type="datetime-local" required value={localDate(event.start_at)} onChange={e=>change('start_at',e.target.value?new Date(e.target.value).toISOString():null)}/></label><label><T>{"Einddatum en tijd"}</T><input type="datetime-local" value={localDate(event.end_at)} onChange={e=>change('end_at',e.target.value?new Date(e.target.value).toISOString():null)}/></label></>}</T>
      <T>{field('venue_name',event.municipal_key?'Vestiging / handelsnaam':'Locatie / zaal')}</T><T>{field('address','Adres')}</T><T>{field('postcode','Postcode')}</T><T>{event.municipal_key?<label><T>{"Vestigingsgemeente (wijziging via de beheerder)"}</T><input readOnly value={String(event.city||'')}/></label>:field('city','Plaats','text',true)}</T><T>{field('contact_phone','Telefoon','tel')}</T><T>{!!event.municipal_key&&<><T>{field('municipal_email','Zakelijk e-mailadres','email')}</T><T>{field('municipal_hours','Openingstijden')}</T></>}</T><T>{field('website_url','Website')}</T><T>{field('booking_url',event.municipal_key?'Afspraak- of contactlink':'Reserveringslink')}</T><T>{event.is_manual_entry?field('source_url','Informatiebron','text',true):<label><T>{"Oorspronkelijke informatiebron (blijft behouden)"}</T><input readOnly value={String(event.source_url??'')}/></label>}</T>
      <T>{!event.municipal_key&&<><label><input type="checkbox" checked={event.is_free===true} onChange={e=>change('is_free',e.target.checked)}/><T>{" Gratis activiteit"}</T></label><T>{!event.is_free&&<><T>{field('price_from','Prijs vanaf (€)','number')}</T><T>{field('price_to','Prijs tot (€)','number')}</T></>}</T></>}</T>
      <T>{!photoPreview&&typeof event.image_url==='string'&&event.image_url&&<figure className="owner-photo-preview"><A><img className="owner-photo" src={event.image_url} alt="Opgeslagen foto van je vermelding"/></A><figcaption><T>{"Huidige opgeslagen foto"}</T></figcaption></figure>}</T>
      <label><T>{"Foto vervangen (JPG, PNG, WebP, maximaal 5 MB)"}</T><input ref={photoInput} disabled={busy} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e=>choosePhoto(e.target.files?.[0]??null)}/></label>
      <T>{photoError&&<p role="alert"><T>{photoError}</T></p>}</T>
      <T>{photoPreview&&<figure className="owner-photo-preview"><A><img className="owner-photo" src={photoPreview} alt="Voorbeeld van de gekozen nieuwe foto" onError={()=>setPhotoError('Deze foto kan niet worden getoond. Kies een andere JPG-, PNG- of WebP-foto.')}/></A><figcaption><T>{"Voorbeeld van je nieuwe foto — klik op ‘Wijzigingen opslaan’ om deze te plaatsen."}</T></figcaption><button type="button" disabled={busy} onClick={()=>{setPhoto(null);setPhotoError('');}}><T>{"Gekozen foto annuleren"}</T></button></figure>}</T>
      <button type="submit" disabled={busy||!!photoError} aria-describedby="owner-save-status"><T>{saving?'Foto en wijzigingen worden opgeslagen…':'Wijzigingen opslaan'}</T></button>
      <div id="owner-save-status" role="status" aria-live="polite" aria-atomic="true"><T>{saving?<p className="owner-save-message"><T>{"Bezig met opslaan. Wacht tot de bevestiging verschijnt."}</T></p>:message?<p className="owner-save-message"><T>{message}</T></p>:null}</T></div></form></div>
      <div hidden={section!=='advertise'}><T>{access&&<AdvertisingUpgrade key={access.id} access={access} event={event} advertising={ad} paymentReady={paymentReady} busy={busy} advertisements={advertisements} onCreated={created=>{setAd(created);setAdvertisements(previous=>[created,...previous.filter(item=>item.id!==created.id)]);}} onCheckout={checkout}/>}</T></div>
      <section hidden={section!=='payments'} aria-labelledby="owner-payments-heading">
        {access&&<MonthlySubscriptions access={access}/>}
        <h2 id="owner-payments-heading"><T>Betalingen en aanvragen</T></h2>
        <p><T>Hier vind je alle advertentieaanvragen voor deze vermelding, met het bedrag, de periode en de betaalstatus. Een verlopen betaallink kun je hier opnieuw openen.</T></p>
        {!advertisements.length?<p><T>Je hebt nog geen advertentieaanvragen voor deze vermelding.</T></p>:advertisements.map(item=><article className="owner-payment-card" key={item.id}>
          <h3><T>{advertisingOrderTypes(item).map(type=>event.municipal_key&&type==='homepage'?'Gemeentepartner':event.municipal_key&&type==='category'?'Rubriekpartner':ADVERTISING_LABELS[type]).join(' + ')}</T></h3>
          <p><T>Periode:</T> {item.starts_on} <T>tot</T> {item.ends_on}</p>
          <p className="owner-payment-total">€ {(item.amount_cents/100).toFixed(2).replace('.',',')} <span><T>{advertisementPaymentLabel(item.payment_status)}</T></span></p>
          <div className="management-link-actions">
            {item.id&&canResumeAdvertisement(item)&&<button type="button" disabled={busy||!paymentReady} onClick={()=>void checkout(item.id)}><T>{item.payment_status==='open'?'Betaling hervatten via Mollie':'Betalen via Mollie'}</T></button>}
            {item.id&&item.payment_status!=='requested'&&<button type="button" disabled={busy||!paymentReady} onClick={()=>void refreshPayment(item.id!)}><T>Betaalstatus controleren</T></button>}
          </div>
        </article>)}
        <p><T>Een advertentie verschijnt na goedkeuring en betaalbevestiging, uitsluitend in de afgesproken periode.</T></p>
        {!paymentReady&&<p><T>Online betalen is momenteel niet beschikbaar. Probeer het later opnieuw.</T></p>}
        <p><T>Vragen over een betaling of factuur?</T> <a href="mailto:info@cotededuras.com">info@cotededuras.com</a></p>
        <button type="button" onClick={()=>setSection('advertise')}><T>Advertentievormen bekijken</T></button>
      </section>
      <section hidden={section!=='access'}><h2><T>Beheerlink & hulp</T></h2>
        <p><T>Je persoonlijke beheerlink geeft toegang tot deze vermelding en de bijbehorende betalingen. Deel deze niet met anderen.</T></p>
        {access&&<div className="management-link-actions"><button type="button" onClick={()=>void navigator.clipboard.writeText(window.location.origin+'/mijn-vermelding#'+access.id+':'+access.token).then(()=>setMessage('Beheerlink gekopieerd. Bewaar deze als een wachtwoord.')).catch(()=>setMessage('Kopiëren lukt niet. Bewaar je beheerlink als bestand.'))}><T>Beheerlink kopiëren</T></button><a download="Cote-de-Duras-beheerlink.txt" href={'data:text/plain;charset=utf-8,'+encodeURIComponent(window.location.origin+'/mijn-vermelding#'+access.id+':'+access.token)}><T>Beheerlink bewaren als bestand</T></a></div>}
        <p><T>Kun je een gegeven niet zelf aanpassen? Geef hieronder een correctie door aan de beheerder.</T></p>
        {access&&<ListingRequestForm key={access.id} eventId={access.id} title={String(event.title)} correctionOnly/>}
      </section>
      <p><button type="button" onClick={()=>{setAccess(null);setEvent(null);setUpgradeTarget(null);setMessage('');setAdvertisements([]);setAd(null);setEntrySection('link');window.history.replaceState(null,'','/mijn-vermelding');sessionStorage.removeItem('cdd-management-session');}}><T>{"Andere vermelding openen"}</T></button></p></>}</T>
    </>}
  </main>;
}
