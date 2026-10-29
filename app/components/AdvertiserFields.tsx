"use client";
import {advertisingQuote,MONTHLY_PRICES,type AdvertiserDetails} from '../../lib/advertising';
export default function AdvertiserFields({type,value,onChange}:{type:keyof typeof MONTHLY_PRICES;value:AdvertiserDetails;onChange:(value:AdvertiserDetails)=>void}){
  let quote;try{quote=advertisingQuote(type,value);}catch{}
  const field=(key:Exclude<keyof AdvertiserDetails,'months'|'startDate'>,label:string,required=true,inputType='text')=><label key={key}>{label}{required?' *':''}<input type={inputType} required={required} maxLength={250} value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})}/></label>;
  return <div className="advertiser-fields"><h3>Advertentieperiode & factuurgegevens</h3><p>€{MONTHLY_PRICES[type]/100} per maand, het definitieve te betalen bedrag. De advertentie verschijnt alleen in de gekozen periode, na goedkeuring en betaalbevestiging.</p>
    <div className="advertiser-field-grid"><label>Begindatum *<input type="date" required value={value.startDate} onChange={e=>onChange({...value,startDate:e.target.value})}/></label><label>Aantal maanden *<select value={value.months} onChange={e=>onChange({...value,months:Number(e.target.value)})}>{Array.from({length:12},(_,i)=><option value={i+1} key={i}>{i+1}</option>)}</select></label>
    {field('name','Contactpersoon')}{field('company','Bedrijfsnaam',false)}{field('email','E-mailadres',true,'email')}{field('phone','Telefoon',true,'tel')}{field('address','Factuuradres')}{field('postcode','Postcode')}{field('city','Plaats')}{field('country','Landcode, bijvoorbeeld FR of NL')}{field('vatNumber','Btw-nummer',false)}</div>
    {quote&&<p><strong>Totaal: €{(quote.amountCents/100).toFixed(2).replace('.',',')}</strong> voor {quote.months} maand(en), van {quote.startDate} tot {quote.endDate} (einddatum niet inbegrepen).</p>}
    <p>Betaling verloopt straks via Mollie. Betaalstatus wordt uitsluitend door de server gecontroleerd; een aanvraag activeert geen advertentie. Je factuurgegevens staan niet in de openbare vermelding.</p>
  </div>;
}
