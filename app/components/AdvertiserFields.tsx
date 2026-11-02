"use client";
import {T, A, useLanguage} from '../i18n/Language';


import {intlLocale} from '../../lib/i18n';

import {advertisingQuote,advertisingSelectionQuote,MONTHLY_PRICES,type AdvertiserDetails,type AdvertisingType} from '../../lib/advertising';
export default function AdvertiserFields({type,placements,value,onChange}:{type:keyof typeof MONTHLY_PRICES;placements?:AdvertisingType[];value:AdvertiserDetails;onChange:(value:AdvertiserDetails)=>void}){
  const {locale}=useLanguage();
  const money=(cents:number)=>new Intl.NumberFormat(intlLocale[locale],{style:'currency',currency:'EUR'}).format(cents/100);
  let quote;try{quote=placements?advertisingSelectionQuote(placements,value):advertisingQuote(type,value);}catch{}
  const field=(key:Exclude<keyof AdvertiserDetails,'months'|'startDate'>,label:string,required=true,inputType='text')=><label key={key}><T>{label}</T><T>{required?' *':''}</T><input type={inputType} required={required} maxLength={250} value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})}/></label>;
  return <div className="advertiser-fields"><h3><T>{"Advertentieperiode & factuurgegevens"}</T></h3><p><T>{money((placements??[type]).reduce((sum,item)=>sum+MONTHLY_PRICES[item],0))}</T><T>{" per maand voor je volledige keuze. Alle gekozen advertenties worden samen betaald en verschijnen alleen in de gekozen periode, na goedkeuring en betaalbevestiging."}</T></p>
    <div className="advertiser-field-grid"><label><T>{"Begindatum *"}</T><input type="date" required value={value.startDate} onChange={e=>onChange({...value,startDate:e.target.value})}/></label><label><T>{"Aantal maanden *"}</T><select value={value.months} onChange={e=>onChange({...value,months:Number(e.target.value)})}><T>{Array.from({length:12},(_,i)=><option value={i+1} key={i}><T>{i+1}</T></option>)}</T></select></label>
    <T>{field('name','Contactpersoon')}</T><T>{field('company','Bedrijfsnaam',false)}</T><T>{field('email','E-mailadres',true,'email')}</T><T>{field('phone','Telefoon',true,'tel')}</T><T>{field('address','Factuuradres')}</T><T>{field('postcode','Postcode')}</T><T>{field('city','Plaats')}</T><T>{field('country','Landcode, bijvoorbeeld FR of NL')}</T><T>{field('vatNumber','Btw-nummer',false)}</T></div>
    <T>{quote&&<p><strong><T>{"Totaal: "}</T><T>{money(quote.amountCents)}</T></strong><T>{" voor "}</T><T>{quote.months}</T><T>{" maand(en), van "}</T><T>{quote.startDate}</T><T>{" tot "}</T><T>{quote.endDate}</T><T>{" (einddatum niet inbegrepen)."}</T></p>}</T>
    <p><T>{"Na ‘Opslaan en betalen via Mollie’ ga je direct naar de beveiligde betaalomgeving. Daar kies je je betaalmethode. Je hoeft niet opnieuw in te loggen. Je factuurgegevens staan niet in de openbare vermelding."}</T></p>
  </div>;
}
