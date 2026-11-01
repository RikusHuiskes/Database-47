"use client";
import {useState} from 'react';
import {advertisingSelectionQuote,advertisingOrderTypes,emptyAdvertiser,MONTHLY_PRICES,type AdvertiserDetails,type AdvertisingType} from '../../lib/advertising';

export type OwnerAdvertisement={id?:string;amount_cents:number;payment_status:string;starts_on:string;ends_on:string;placement?:string;details?:AdvertiserDetails&{placements?:AdvertisingType[]}};
type Props={access:{id:string;token:string};event:Record<string,unknown>;advertising:OwnerAdvertisement|null;advertisements?:OwnerAdvertisement[];paymentReady:boolean;busy:boolean;onCreated:(ad:OwnerAdvertisement)=>void;onCheckout:(requestId?:string)=>Promise<void>};
const eventLabels={highlight:'Vetomrande vermelding',category:'Categorieadvertentie',homepage:'Homepageadvertentie'};
const euro=(cents:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function ListingPreview({event,highlighted}:{event:Record<string,unknown>;highlighted:boolean}){
 const image=typeof event.image_url==='string'&&/^https?:\/\//i.test(event.image_url)?event.image_url:null;
 const date=event.start_at?new Date(String(event.start_at)):null;
 return <figure className="owner-listing-example">
  <figcaption><strong>{highlighted?'Vetomrande advertentie':'Normale vermelding'}</strong><span>{highlighted?`${euro(MONTHLY_PRICES.highlight)} per maand`:'Gratis'}</span></figcaption>
  <article className={`activity-card${highlighted?' activity-card-highlighted':''}`}>
   {highlighted&&<div className="activity-highlight-banner">Uitgelichte advertentie</div>}
   <div className="activity-media">{image?<img className="activity-image" src={image} alt=""/>:<div className="activity-image-placeholder"><span aria-hidden="true">47</span><small>Ontdek dichtbij</small></div>}</div>
   <div className="activity-card-content">
    <h3>{String(event.title||'Je vermelding')}</h3>
    {date&&Number.isFinite(date.getTime())&&<p className="activity-date">{new Intl.DateTimeFormat('nl-NL',{dateStyle:'long',timeZone:'Europe/Paris'}).format(date)}</p>}
    <p className="activity-place">{[event.venue_name,event.address,event.postcode,event.city].filter(Boolean).join(', ')}</p>
    {(event.short_description||event.description)&&<p className="activity-description">{String(event.short_description||event.description)}</p>}
    <div className="activity-links"><span className="activity-link">Bekijk evenementdetails →</span></div>
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
  <h2 id="upgrade-heading">Meer bereik voor deze vermelding</h2>
  <p>Maak van ‘{String(event.title)}’ een betaalde advertentie. Je bestaande tekst, foto, datum en beheerlink blijven behouden. Heb je hierboven gegevens gewijzigd? Sla die eerst op.</p>
  <p>Je kunt alle drie de advertentievormen combineren voor dezelfde vermelding. Vink je gewenste vormen aan en betaal het totaal in één keer via Mollie. Je vermelding blijft ook in de normale resultaten staan; actieve vetomrande vermeldingen komen bovenaan de zoekresultaten.</p>
  <fieldset className="owner-advertising-options" disabled={busy||submitting}>
   <legend>Kies één of meer advertentievormen</legend>
   <div className="owner-advertising-options-grid">
    {(Object.keys(labels) as AdvertisingType[]).map(type=><label className={`owner-advertising-option${selected.includes(type)?' is-selected':''}`} key={type}>
     <span className="owner-advertising-option-heading"><input type="checkbox" name="upgrade-placement" value={type} disabled={blocked(type)} checked={selected.includes(type)} onChange={e=>{setPlacement(type);setSelected(previous=>e.target.checked?[...previous,type]:previous.filter(value=>value!==type));}}/><strong>{labels[type]}</strong></span>
     <span>{euro(MONTHLY_PRICES[type])} per maand</span>
     <span className={`owner-option-sample owner-option-sample-${type}`} aria-hidden="true">{typeof event.image_url==='string'&&/^https?:\/\//i.test(event.image_url)&&<img src={event.image_url} alt=""/>}<span>{type==='highlight'?'Uitgelichte advertentie':type==='category'?(municipal?'Rubriekpartner':'Categoriepartner'):(municipal?'Gemeentepartner':'Homepagepartner')}</span><strong>{String(event.title||'Je vermelding')}</strong></span>
     <small>{type==='highlight'?'Een dikke donkergroene rand tussen de gewone agendaresultaten.':type==='category'?(municipal?'Een advertentie in jouw rubriek en gemeente.':'Een eigen advertentiekaart bij de resultaten van je categorie.'):(municipal?'Een advertentie bij alle rubrieken van jouw gemeente.':'Een eigen advertentiekaart bij de uitgelichte partners op de homepage.')}</small>
     <span className="owner-option-selected">{blocked(type)?'Al betaald of aangevraagd':selected.includes(type)?'✓ Toegevoegd aan je keuze':'Toevoegen aan je keuze'}</span>
    </label>)}
   </div>
  </fieldset>
  <div className="owner-advertising-total" aria-live="polite"><strong>{quote?`Samen te betalen: ${euro(quote.amountCents)}`:'Kies je advertentievormen'}</strong><p>{quote?`${quote.placements.map(type=>labels[type]).join(' + ')} · ${quote.months} maand(en) · één betaling via Mollie`: 'Vink hierboven je keuze aan. Al betaalde of aangevraagde vormen worden niet opnieuw toegevoegd.'}</p></div>
  <div className="owner-listing-comparison" aria-label="Verschil tussen een normale en een betaalde vermelding">
   <ListingPreview event={event} highlighted={false}/>{placement==='highlight'?<ListingPreview event={event} highlighted/>:<figure className="owner-listing-example"><figcaption><strong>{labels[placement]}</strong><span>{euro(MONTHLY_PRICES[placement])} per maand</span></figcaption><div className="owner-partner-preview"><small>Lokale partners · Advertenties</small><h3>{placement==='homepage'?(municipal?'Uitgelicht in '+String(event.city):'Uitgelicht op de homepage'):(municipal?'Uitgelicht in je rubriek':'Uitgelicht in je categorie')}</h3><article className="owner-partner-card">{typeof event.image_url==='string'&&/^https?:\/\//i.test(event.image_url)&&<img src={event.image_url} alt=""/>}<small>{placement==='homepage'?(municipal?'Gemeentepartner':'Homepagepartner'):(municipal?'Rubriekpartner':'Categoriepartner')} · {String(event.city||'In de buurt')}</small><h4>{String(event.title)}</h4><p>{String(event.short_description||event.description||'Ontdek deze vermelding.')}</p><span className="owner-partner-link">Ontdek →</span></article></div></figure>}
  </div>
  <p className="owner-comparison-note">{placement==='highlight'?'De vetomrande advertentie staat bovenaan de zoekresultaten, vóór gewone vermeldingen.':placement==='category'?(municipal?'De rubriekpartner verschijnt in de gekozen gemeente binnen je bedrijfsrubriek.':'De categorieadvertentie verschijnt bij de uitgelichte partners binnen de categorie van deze vermelding.'):(municipal?'De gemeentepartner verschijnt in alle rubrieken van je vestigingsgemeente.':'De homepageadvertentie verschijnt bij de uitgelichte partners op de homepage.')} Dit is een visueel voorbeeld. Plaatsing volgt na goedkeuring, betaalbevestiging en controle van de beschikbaarheid, binnen je gekozen periode.</p>
  <form className="owner-form" onSubmit={submit}>
   <fieldset disabled={busy||submitting}>
    <legend>Gekozen advertenties: {selected.map(type=>labels[type]).join(' + ')||'kies hierboven'}</legend>
    <label>Begindatum<input required type="date" min={today()} value={details.startDate} onChange={e=>change('startDate',e.target.value)}/></label>
    <label>Looptijd<select value={details.months} onChange={e=>change('months',Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1} {i===0?'maand':'maanden'}</option>)}</select></label>
    {!selected.length&&<p role="status">Kies hierboven ten minste één advertentievorm om het totaalbedrag te zien.</p>}
    <h3>Factuurgegevens</h3>
    {([['name','Naam','text',true],['company','Bedrijfsnaam','text',false],['address','Straat en huisnummer','text',true],['postcode','Postcode','text',true],['city','Plaats','text',true],['email','E-mailadres','email',true],['phone','Telefoon','tel',true],['vatNumber','Btw-nummer','text',false]] as const).map(([key,label,type,required])=><label key={key}>{label}{required?' *':''}<input type={type} required={required} value={details[key]} maxLength={250} onChange={e=>change(key,e.target.value)}/></label>)}
    <label>Land<select value={details.country} onChange={e=>change('country',e.target.value)}><option value="FR">Frankrijk</option><option value="NL">Nederland</option><option value="BE">België</option><option value="DE">Duitsland</option><option value="GB">Verenigd Koninkrijk</option><option value="ES">Spanje</option><option value="LU">Luxemburg</option><option value="CH">Zwitserland</option></select></label>
    {quote&&<div className="owner-advertising-total"><strong>Totaal te betalen: {euro(quote.amountCents)}</strong><ul>{quote.placements.map(type=><li key={type}>{labels[type]}: {euro(MONTHLY_PRICES[type])} × {quote.months} maand(en) = {euro(MONTHLY_PRICES[type]*quote.months)}</li>)}</ul><p>Eén betaling via Mollie voor alle gekozen vormen.</p><p>{quote.placements.map(type=>labels[type]).join(' + ')} · {quote.months} maand(en) · van {quote.startDate} tot {quote.endDate} (einddatum exclusief).</p></div>}
    <p>Je kiest je betaalmethode in de beveiligde omgeving van Mollie. Na goedkeuring en betaalbevestiging verschijnt de advertentie binnen de gekozen periode. {municipal?'Voor gemeente- en rubriekpartners controleren we eerst de beschikbaarheid in je vestigingsgemeente.':'Voor homepage- en categorieadvertenties wordt eerst de beschikbaarheid gecontroleerd.'}</p>
    <button type="submit" disabled={!paymentReady||!quote}>{submitting?'Aanvraag wordt opgeslagen…':`Verder naar Mollie${quote?' · '+euro(quote.amountCents):''}`}</button>
    {!paymentReady&&<p>Online betalen is momenteel niet beschikbaar. Probeer het later opnieuw.</p>}
   </fieldset>
  </form>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
