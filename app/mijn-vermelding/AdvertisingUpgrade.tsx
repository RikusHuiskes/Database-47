"use client";
import {T, A, useLanguage} from '../i18n/Language';

import {intlLocale} from '../../lib/i18n';


import {useState} from 'react';
import {advertisingSelectionQuote,advertisingOrderTypes,emptyAdvertiser,MONTHLY_PRICES,type AdvertiserDetails,type AdvertisingType} from '../../lib/advertising';

export type OwnerAdvertisement={id?:string;amount_cents:number;payment_status:string;starts_on:string;ends_on:string;placement?:string;details?:AdvertiserDetails&{placements?:AdvertisingType[]}};
type Props={access:{id:string;token:string};event:Record<string,unknown>;advertising:OwnerAdvertisement|null;advertisements?:OwnerAdvertisement[];paymentReady:boolean;busy:boolean;onCreated:(ad:OwnerAdvertisement)=>void;onCheckout:(requestId?:string)=>Promise<void>};
const eventLabels={highlight:'Vetomrande vermelding',category:'Categorieadvertentie',homepage:'Homepageadvertentie'};
const euro=(cents:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function ListingPreview({event,highlighted}:{event:Record<string,unknown>;highlighted:boolean}){
 const {locale}=useLanguage();
 const image=typeof event.image_url==='string'&&/^https?:\/\//i.test(event.image_url)?event.image_url:null;
 const date=event.start_at?new Date(String(event.start_at)):null;
 return <figure className="owner-listing-example">
  <figcaption><strong><T>{highlighted?'Vetomrande advertentie':'Normale vermelding'}</T></strong><span><T>{highlighted?`${euro(MONTHLY_PRICES.highlight)} per maand`:'Gratis'}</T></span></figcaption>
  <article className={`activity-card${highlighted?' activity-card-highlighted':''}`}>
   <T>{highlighted&&<div className="activity-highlight-banner"><T>{"Uitgelichte advertentie"}</T></div>}</T>
   <div className="activity-media"><T>{image?<A><img className="activity-image" src={image} alt=""/></A>:<div className="activity-image-placeholder"><span aria-hidden="true"><T>{"47"}</T></span><small><T>{"Ontdek dichtbij"}</T></small></div>}</T></div>
   <div className="activity-card-content">
    <h3><T>{String(event.title||'Je vermelding')}</T></h3>
    <T>{date&&Number.isFinite(date.getTime())&&<p className="activity-date"><T>{new Intl.DateTimeFormat(intlLocale[locale],{dateStyle:'long',timeZone:'Europe/Paris'}).format(date)}</T></p>}</T>
    <p className="activity-place"><T preserve>{[event.venue_name,event.address,event.postcode,event.city].filter(Boolean).join(', ')}</T></p>
    <T>{(event.short_description||event.description)&&<p className="activity-description"><T>{String(event.short_description||event.description)}</T></p>}</T>
    <div className="activity-links"><span className="activity-link"><T>{"Bekijk evenementdetails →"}</T></span></div>
   </div>
  </article>
 </figure>;
}
export default function AdvertisingUpgrade({access,event,advertising,advertisements,paymentReady,busy,onCreated,onCheckout}:Props){
 const municipal=!!event.municipal_key;
 const labels=municipal?{highlight:'Vetomrande vermelding',category:'Rubriekpartner',homepage:'Gemeentepartner'}:eventLabels;
 const currentAds=advertisements??(advertising?[advertising]:[]);
 const blocked=(type:AdvertisingType)=>currentAds.some(item=>advertisingOrderTypes(item).includes(type)&&['requested','open','paid'].includes(item.payment_status)&&item.ends_on>today());
 const [placement,setPlacement]=useState<AdvertisingType>('highlight');
 const [selected,setSelected]=useState<AdvertisingType[]>(()=>{const types=typeof window==='undefined'?[]:(new URLSearchParams(window.location.search).get('placements')||'').split(',').filter((type):type is AdvertisingType=>['highlight','category','homepage'].includes(type));return types.length?[...new Set(types)].filter(type=>!blocked(type)):blocked('highlight')?[]:['highlight'];});
 const [details,setDetails]=useState<AdvertiserDetails>(()=>({...emptyAdvertiser,...advertising?.details,startDate:today(),months:typeof window==='undefined'?1:Math.min(12,Math.max(1,Number(new URLSearchParams(window.location.search).get('months'))||1))}));
 const [submitting,setSubmitting]=useState(false),[error,setError]=useState('');
 let quote:ReturnType<typeof advertisingSelectionQuote>|null=null;try{quote=advertisingSelectionQuote(selected,details);}catch{}
 async function submit(e:React.FormEvent){
  e.preventDefault();setSubmitting(true);setError('');
  try{
   const response=await fetch('/api/managed-event/advertising',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({eventId:access.id,placements:selected,advertiser:details})});
   const data=await response.json();if(!response.ok)throw Error(data.error);
   onCreated(data.advertising);await onCheckout(data.advertising.id);
  }catch(err){setError(err instanceof Error?err.message:'Aanvragen mislukt.');}finally{setSubmitting(false);}
 }
 const change=(key:keyof AdvertiserDetails,value:string|number)=>setDetails(previous=>({...previous,[key]:value}));
 return <section id="listing-upgrade" className="owner-advertising-upgrade" aria-labelledby="upgrade-heading">
  <h2 id="upgrade-heading"><T>{"Meer bereik voor deze vermelding"}</T></h2>
  <p><T>{"Maak van ‘"}</T><T>{String(event.title)}</T><T>{"’ een betaalde advertentie. Je bestaande tekst, foto, datum en beheerlink blijven behouden. Heb je hierboven gegevens gewijzigd? Sla die eerst op."}</T></p>
  <p><T>{"Je kunt alle drie de advertentievormen combineren voor dezelfde vermelding. Vink je gewenste vormen aan en betaal het totaal in één keer via Mollie. Je vermelding blijft ook in de normale resultaten staan; actieve vetomrande vermeldingen komen bovenaan de zoekresultaten."}</T></p>
  <fieldset className="owner-advertising-options" disabled={busy||submitting}>
   <legend><T>{"Kies één of meer advertentievormen"}</T></legend>
   <div className="owner-advertising-options-grid">
    <T>{(Object.keys(labels) as AdvertisingType[]).map(type=><label className={`owner-advertising-option${selected.includes(type)?' is-selected':''}`} key={type}>
     <span className="owner-advertising-option-heading"><input type="checkbox" name="upgrade-placement" value={type} disabled={blocked(type)} checked={selected.includes(type)} onChange={e=>{setPlacement(type);setSelected(previous=>e.target.checked?[...previous,type]:previous.filter(value=>value!==type));}}/><strong><T>{labels[type]}</T></strong></span>
     <span><T>{euro(MONTHLY_PRICES[type])}</T><T>{" per maand"}</T></span>
     <span className={`owner-option-sample owner-option-sample-${type}`} aria-hidden="true"><T>{typeof event.image_url==='string'&&/^https?:\/\//i.test(event.image_url)&&<A><img src={event.image_url} alt=""/></A>}</T><span><T>{type==='highlight'?'Uitgelichte advertentie':type==='category'?(municipal?'Rubriekpartner':'Categoriepartner'):(municipal?'Gemeentepartner':'Homepagepartner')}</T></span><strong><T>{String(event.title||'Je vermelding')}</T></strong></span>
     <small><T>{type==='highlight'?'Een dikke donkergroene rand tussen de gewone agendaresultaten.':type==='category'?(municipal?'Een advertentie in jouw rubriek en gemeente.':'Een eigen advertentiekaart bij de resultaten van je categorie.'):(municipal?'Een advertentie bij alle rubrieken van jouw gemeente.':'Een eigen advertentiekaart bij de uitgelichte partners op de homepage.')}</T></small>
     <span className="owner-option-selected"><T>{blocked(type)?'Al betaald of aangevraagd':selected.includes(type)?'✓ Toegevoegd aan je keuze':'Toevoegen aan je keuze'}</T></span>
    </label>)}</T>
   </div>
  </fieldset>
  <div className="owner-advertising-total" aria-live="polite"><strong><T>{quote?`Samen te betalen: ${euro(quote.amountCents)}`:'Kies je advertentievormen'}</T></strong><p><T>{quote?`${quote.placements.map(type=>labels[type]).join(' + ')} · ${quote.months} maand(en) · één betaling via Mollie`: 'Vink hierboven je keuze aan. Al betaalde of aangevraagde vormen worden niet opnieuw toegevoegd.'}</T></p></div>
  <A><div className="owner-listing-comparison" aria-label="Verschil tussen een normale en een betaalde vermelding">
   <ListingPreview event={event} highlighted={false}/><T>{placement==='highlight'?<ListingPreview event={event} highlighted/>:<figure className="owner-listing-example"><figcaption><strong><T>{labels[placement]}</T></strong><span><T>{euro(MONTHLY_PRICES[placement])}</T><T>{" per maand"}</T></span></figcaption><div className="owner-partner-preview"><small><T>{"Lokale partners · Advertenties"}</T></small><h3><T>{placement==='homepage'?(municipal?'Uitgelicht in '+String(event.city):'Uitgelicht op de homepage'):(municipal?'Uitgelicht in je rubriek':'Uitgelicht in je categorie')}</T></h3><article className="owner-partner-card"><T>{typeof event.image_url==='string'&&/^https?:\/\//i.test(event.image_url)&&<A><img src={event.image_url} alt=""/></A>}</T><small><T>{placement==='homepage'?(municipal?'Gemeentepartner':'Homepagepartner'):(municipal?'Rubriekpartner':'Categoriepartner')}</T><T>{" · "}</T><T>{String(event.city||'In de buurt')}</T></small><h4><T>{String(event.title)}</T></h4><p><T>{String(event.short_description||event.description||'Ontdek deze vermelding.')}</T></p><span className="owner-partner-link"><T>{"Ontdek →"}</T></span></article></div></figure>}</T>
  </div></A>
  <p className="owner-comparison-note"><T>{placement==='highlight'?'De vetomrande advertentie staat bovenaan de zoekresultaten, vóór gewone vermeldingen.':placement==='category'?(municipal?'De rubriekpartner verschijnt in de gekozen gemeente binnen je bedrijfsrubriek.':'De categorieadvertentie verschijnt bij de uitgelichte partners binnen de categorie van deze vermelding.'):(municipal?'De gemeentepartner verschijnt in alle rubrieken van je vestigingsgemeente.':'De homepageadvertentie verschijnt bij de uitgelichte partners op de homepage.')}</T><T>{" Dit is een visueel voorbeeld. Plaatsing volgt na goedkeuring, betaalbevestiging en controle van de beschikbaarheid, binnen je gekozen periode."}</T></p>
  <form className="owner-form" onSubmit={submit}>
   <fieldset disabled={busy||submitting}>
    <legend><T>{"Gekozen advertenties: "}</T><T>{selected.map(type=>labels[type]).join(' + ')||'kies hierboven'}</T></legend>
    <label><T>{"Begindatum"}</T><input required type="date" min={today()} value={details.startDate} onChange={e=>change('startDate',e.target.value)}/></label>
    <label><T>{"Looptijd"}</T><select value={details.months} onChange={e=>change('months',Number(e.target.value))}><T>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}><T>{i+1}</T> <T>{i===0?'maand':'maanden'}</T></option>)}</T></select></label>
    <T>{!selected.length&&<p role="status"><T>{"Kies hierboven ten minste één advertentievorm om het totaalbedrag te zien."}</T></p>}</T>
    <h3><T>{"Factuurgegevens"}</T></h3>
    <T>{([['name','Naam','text',true],['company','Bedrijfsnaam','text',false],['address','Straat en huisnummer','text',true],['postcode','Postcode','text',true],['city','Plaats','text',true],['email','E-mailadres','email',true],['phone','Telefoon','tel',true],['vatNumber','Btw-nummer','text',false]] as const).map(([key,label,type,required])=><label key={key}><T>{label}</T><T>{required?' *':''}</T><input type={type} required={required} value={details[key]} maxLength={250} onChange={e=>change(key,e.target.value)}/></label>)}</T>
    <label><T>{"Land"}</T><select value={details.country} onChange={e=>change('country',e.target.value)}><option value="FR"><T>{"Frankrijk"}</T></option><option value="NL"><T>{"Nederland"}</T></option><option value="BE"><T>{"België"}</T></option><option value="DE"><T>{"Duitsland"}</T></option><option value="GB"><T>{"Verenigd Koninkrijk"}</T></option><option value="ES"><T>{"Spanje"}</T></option><option value="LU"><T>{"Luxemburg"}</T></option><option value="CH"><T>{"Zwitserland"}</T></option></select></label>
    <T>{quote&&<div className="owner-advertising-total"><strong><T>{"Totaal te betalen: "}</T><T>{euro(quote.amountCents)}</T></strong><ul><T>{quote.placements.map(type=><li key={type}><T>{labels[type]}</T><T>{": "}</T><T>{euro(MONTHLY_PRICES[type])}</T><T>{" × "}</T><T>{quote.months}</T><T>{" maand(en) = "}</T><T>{euro(MONTHLY_PRICES[type]*quote.months)}</T></li>)}</T></ul><p><T>{"Eén betaling via Mollie voor alle gekozen vormen."}</T></p><p><T>{quote.placements.map(type=>labels[type]).join(' + ')}</T><T>{" · "}</T><T>{quote.months}</T><T>{" maand(en) · van "}</T><T>{quote.startDate}</T><T>{" tot "}</T><T>{quote.endDate}</T><T>{" (einddatum exclusief)."}</T></p></div>}</T>
    <p><T>{"Je kiest je betaalmethode in de beveiligde omgeving van Mollie. Na goedkeuring en betaalbevestiging verschijnt de advertentie binnen de gekozen periode. "}</T><T>{municipal?'Voor gemeente- en rubriekpartners controleren we eerst de beschikbaarheid in je vestigingsgemeente.':'Voor homepage- en categorieadvertenties wordt eerst de beschikbaarheid gecontroleerd.'}</T></p>
    <button type="submit" disabled={!paymentReady||!quote}><T>{submitting?'Aanvraag wordt opgeslagen…':`Verder naar Mollie${quote?' · '+euro(quote.amountCents):''}`}</T></button>
    <T>{!paymentReady&&<p><T>{"Online betalen is momenteel niet beschikbaar. Probeer het later opnieuw."}</T></p>}</T>
   </fieldset>
  </form>
  <T>{error&&<p role="alert"><T>{error}</T></p>}</T>
 </section>;
}
