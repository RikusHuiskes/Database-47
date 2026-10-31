"use client";
import {useState} from 'react';
import {advertisingQuote,emptyAdvertiser,MONTHLY_PRICES,type AdvertiserDetails,type AdvertisingType} from '../../lib/advertising';

export type OwnerAdvertisement={amount_cents:number;payment_status:string;starts_on:string;ends_on:string;placement?:string;details?:AdvertiserDetails};
type Props={access:{id:string;token:string};event:Record<string,unknown>;advertising:OwnerAdvertisement|null;paymentReady:boolean;busy:boolean;onCreated:(ad:OwnerAdvertisement)=>void;onCheckout:()=>Promise<void>};
const labels={highlight:'Vetomrande vermelding',category:'Categorieadvertentie',homepage:'Homepageadvertentie'};
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
export default function AdvertisingUpgrade({access,event,advertising,paymentReady,busy,onCreated,onCheckout}:Props){
 const [placement,setPlacement]=useState<AdvertisingType>('highlight');
 const [details,setDetails]=useState<AdvertiserDetails>(()=>({...emptyAdvertiser,...advertising?.details,startDate:today(),months:1}));
 const [submitting,setSubmitting]=useState(false),[error,setError]=useState('');
 let quote:ReturnType<typeof advertisingQuote>|null=null;try{quote=advertisingQuote(placement,details);}catch{}
 const pending=advertising&&['requested','open','paid'].includes(advertising.payment_status)&&advertising.ends_on>today();
 const active=event.promotion_status==='active'&&(!event.promotion_end_at||String(event.promotion_end_at)>new Date().toISOString());
 async function submit(e:React.FormEvent){
  e.preventDefault();setSubmitting(true);setError('');
  try{
   const response=await fetch('/api/managed-event/advertising',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({eventId:access.id,placement,advertiser:details})});
   const data=await response.json();if(!response.ok)throw Error(data.error);
   onCreated(data.advertising);await onCheckout();
  }catch(err){setError(err instanceof Error?err.message:'Aanvragen mislukt.');}finally{setSubmitting(false);}
 }
 const change=(key:keyof AdvertiserDetails,value:string|number)=>setDetails(previous=>({...previous,[key]:value}));
 return <section className="owner-advertising-upgrade" aria-labelledby="upgrade-heading">
  <h2 id="upgrade-heading">Meer bereik voor deze vermelding</h2>
  <p>Maak van ‘{String(event.title)}’ een betaalde advertentie. Je bestaande tekst, foto, datum en beheerlink blijven behouden. Heb je hierboven gegevens gewijzigd? Sla die eerst op.</p>
  <div className="owner-listing-comparison" aria-label="Verschil tussen een normale en een vetomrande vermelding">
   <ListingPreview event={event} highlighted={false}/><ListingPreview event={event} highlighted/>
  </div>
  <p className="owner-comparison-note">Dezelfde vermelding, extra opvallend: een dikke donkergroene rand, een lichte crèmeachtergrond en het label ‘Uitgelichte advertentie’. De vetomrande advertentie staat tussen de gewone resultaten; de volgorde verandert hierdoor niet. Dit is een voorbeeld van de weergave, geen bevestiging dat je advertentie al actief is.</p>
  {pending||active?<p>Deze vermelding heeft al een lopende advertentie of aanvraag. Hieronder vind je de betaalstatus en kun je een openstaande betaling afronden. Neem contact op met de beheerder als je de advertentievorm wilt veranderen.</p>:<form className="owner-form" onSubmit={submit}>
   <fieldset disabled={busy||submitting}>
    <legend>Advertentievorm</legend>
    {(Object.keys(labels) as AdvertisingType[]).map(type=><label className="owner-advertising-choice" key={type}><input type="radio" name="upgrade-placement" value={type} checked={placement===type} onChange={()=>setPlacement(type)}/><span><strong>{labels[type]}</strong> · {euro(MONTHLY_PRICES[type])} per maand<br/><small>{type==='highlight'?'Een opvallende donkergroene rand tussen de gewone resultaten.':type==='category'?'Een plek bij de uitgelichte advertenties in je bestaande categorie.':'Een plek bij de uitgelichte advertenties op de homepage.'}</small></span></label>)}
    <label>Begindatum<input required type="date" min={today()} value={details.startDate} onChange={e=>change('startDate',e.target.value)}/></label>
    <label>Looptijd<select value={details.months} onChange={e=>change('months',Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1} {i===0?'maand':'maanden'}</option>)}</select></label>
    <h3>Factuurgegevens</h3>
    {([['name','Naam','text',true],['company','Bedrijfsnaam','text',false],['address','Straat en huisnummer','text',true],['postcode','Postcode','text',true],['city','Plaats','text',true],['email','E-mailadres','email',true],['phone','Telefoon','tel',true],['vatNumber','Btw-nummer','text',false]] as const).map(([key,label,type,required])=><label key={key}>{label}{required?' *':''}<input type={type} required={required} value={details[key]} maxLength={250} onChange={e=>change(key,e.target.value)}/></label>)}
    <label>Land<select value={details.country} onChange={e=>change('country',e.target.value)}><option value="FR">Frankrijk</option><option value="NL">Nederland</option><option value="BE">België</option><option value="DE">Duitsland</option><option value="GB">Verenigd Koninkrijk</option><option value="ES">Spanje</option><option value="LU">Luxemburg</option><option value="CH">Zwitserland</option></select></label>
    {quote&&<div className="owner-advertising-total" aria-live="polite"><strong>Totaal te betalen: {euro(quote.amountCents)}</strong><p>{labels[placement]} · {quote.months} maand(en) · van {quote.startDate} tot {quote.endDate} (einddatum exclusief).</p></div>}
    <p>Je kiest je betaalmethode in de beveiligde omgeving van Mollie. Na goedkeuring en betaalbevestiging verschijnt de advertentie binnen de gekozen periode. Voor homepage- en categorieadvertenties wordt eerst de beschikbaarheid gecontroleerd.</p>
    <button type="submit" disabled={!paymentReady||!quote}>{submitting?'Aanvraag wordt opgeslagen…':`Verder naar Mollie${quote?' · '+euro(quote.amountCents):''}`}</button>
    {!paymentReady&&<p>Online betalen is momenteel niet beschikbaar. Probeer het later opnieuw.</p>}
   </fieldset>
  </form>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
