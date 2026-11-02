"use client";
import {T, A} from '../i18n/Language';




import {MONTHLY_PRICES,type AdvertisingType} from '../../lib/advertising';
import {useRef} from 'react';
import AdvertisingPlacementPreviews from './AdvertisingPlacementPreviews';
import g from '../gemeentegids/adverteren/preview.module.css';
import s from './event-advertising-examples.module.css';

type Choice='none'|AdvertisingType;
type Props={value:AdvertisingType[];onChange:(value:AdvertisingType[])=>void;months:number;onMonthsChange:(months:number)=>void;title:string;city:string;category:string;image:string;categories:{id:string;name:string}[];description:string;date:string};
const labels:Record<Choice,string>={none:'Gratis vermelding',highlight:'Vetomrande vermelding',category:'Categorieadvertentie',homepage:'Homepageadvertentie'};
const descriptions:Record<Choice,string>={none:'Je vermelding verschijnt na goedkeuring tussen de gewone resultaten.',highlight:'Een dikke donkergroene rand en bovenaan de zoekresultaten.',category:'Een extra advertentiekaart in de rechterkolom bij jouw categorie.',homepage:'Een extra advertentiekaart in de rechterkolom op de homepage.'};
const choices:AdvertisingType[]=['highlight','category','homepage'];
const eyebrows={highlight:'Bovenaan de resultaten',category:'Extra zichtbaar in jouw categorie',homepage:'Bereik bezoekers op de homepage'};
const explanations={highlight:'Je vermelding krijgt een donkergroene rand en staat bovenaan de zoekresultaten binnen je gekozen categorie.',category:'Een eigen advertentiekaart in de rechterkolom bij jouw categorie, naast je gewone vermelding.',homepage:'Je advertentie is zichtbaar in de rechterkolom op de homepage. Je vermelding blijft ook in de gewone resultaten staan.'};
const money=(cents:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100);
export default function EventAdvertisingExamples({value,onChange,months,onMonthsChange,title,city,category,image,description}:Props){
 const review=useRef<HTMLDialogElement>(null);
 const total=value.reduce((sum,type)=>sum+MONTHLY_PRICES[type]*months,0);
 const chosen=(type:Choice)=>type==='none'?value.length===0:value.includes(type);
 const toggle=(type:Choice)=>onChange(type==='none'?[]:chosen(type)?value.filter(item=>item!==type):[...value,type]);
 const name=title.trim()||'Côte de Duras · voorbeeld',place=city.trim()||'Duras & omgeving',rubric=category||'Jouw categorie';
 return <div className={s.root}>
  <div className={g.sectionHeading}><div><p className={g.kicker}><T>{"01 · Jouw advertentie"}</T></p><h3 className={s.choiceHeading}><T>{"Hoe wil je opvallen?"}</T></h3></div><span className={g.priceNote}><T>{"Tarieven · per maand"}</T></span></div>
  <p><T>{"Vink één, twee of drie advertentievormen aan. Bekijk wat je koopt en betaal alle gekozen vormen samen in één keer."}</T></p>
  <div className={g.choices}><T>{choices.map(type=><label className={g.choice+' '+(chosen(type)?g.selected:'')} key={type}>
   <span className={g.choiceTitle}><input type="checkbox" name="promotion-type" value={type} checked={chosen(type)} onChange={()=>toggle(type)} aria-controls="event-advertising-example"/><strong><T>{labels[type]}</T></strong></span>
   <small className={g.eyebrow}><T>{eyebrows[type]}</T></small>
   <span className={s.placementSample} aria-hidden="true"><span className={s.browserChrome}><i/><i/><i/><small><T>{type==='homepage'?'Homepage':rubric}</T></small></span>{type==='homepage'&&<span className={s.miniHomeIntro}><T>Ontdek Duras en omgeving.</T><small><T>Agenda</T> · <T>Gemeentegids</T></small></span>}<span className={s.miniLayout}><span className={s.miniResults}>{type==='highlight'&&<span className={s.miniHighlight}><img src="/cote-de-duras-logo.webp" alt=""/><strong>Côte de Duras</strong><small><T>Advertentie</T></small></span>}<span className={s.miniOrdinary}/><span className={s.miniOrdinary}/>{type!=='highlight'&&<span className={s.miniOrdinary}/>}</span><span className={s.miniRail}>{type!=='highlight'&&<span className={s.miniPartner}><img src="/cote-de-duras-logo.webp" alt=""/><strong>Côte de Duras</strong><small><T>{type==='homepage'?'Homepagepartner':'Categoriepartner'}</T></small></span>}</span></span><span className={s.placementCaption}><T>{type==='highlight'?'Bovenaan in de resultaten':type==='category'?'Rechts naast jouw categorie':'Rechts op de homepage'}</T></span></span>
   <p><T>{explanations[type]}</T></p><span className={g.price}><strong><T>{money(MONTHLY_PRICES[type])}</T></strong><span><T>{"/ maand"}</T></span></span><span className={g.selectionLabel}><T>{chosen(type)?'✓ Toegevoegd aan je keuze':'Voeg toe aan je keuze'}</T></span>
  </label>)}</T></div>
  <div className={s.purchaseSummary} aria-live="polite"><strong><T>Dit kies je:</T></strong>{value.length?value.map(type=><span key={type}><b>✓ <T>{labels[type]}</T></b><T>{descriptions[type]}</T></span>):<span><T>Gratis: een gewone vermelding tussen de andere resultaten.</T></span>}<a href="#event-advertising-example"><T>Bekijk de plaatsing hieronder ↓</T></a></div>
  <div className={g.selectionBar}><label><T>{"Looptijd"}</T><A><select aria-label="Looptijd advertentie" value={months} onChange={event=>onMonthsChange(Number(event.target.value))}><T>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}><T>{i+1}</T> <T>{i===0?'maand':'maanden'}</T></option>)}</T></select></A></label><div aria-live="polite"><small><T>{value.length}</T><T>{value.length===1?" advertentievorm":" advertentievormen"}</T><T>{" · "}</T><T>{months}</T><T>{months===1?" maand":" maanden"}</T></small><strong><T>{money(total)}</T> <span><T>{"totaal"}</T></span></strong></div><button type="button" className={g.primary} disabled={!value.length} onClick={()=>review.current?.showModal()}><T>{"Bekijk betaaloverzicht →"}</T></button></div>
  <label className={s.freeChoice}><input type="checkbox" name="promotion-type" value="none" checked={chosen('none')} onChange={()=>toggle('none')}/><span><strong><T>{"Gratis vermelding"}</T></strong><T>{" · Liever alleen een gewone vermelding? Hiermee wis je de betaalde keuzes."}</T></span></label>
  <dialog ref={review} className={g.dialog} aria-labelledby="event-ad-review-heading"><A><button type="button" className={g.close} aria-label="Betaaloverzicht sluiten" onClick={()=>review.current?.close()}><T>{"×"}</T></button></A><span className={g.pill}><T>{"Eén gezamenlijke betaling"}</T></span><h2 id="event-ad-review-heading"><T>{"Jouw advertentieoverzicht"}</T></h2><p><strong><T>{name}</T></strong><br/><T>{rubric}</T><T>{" · "}</T><T>{place}</T><T>{" · "}</T><T>{months}</T><T>{months===1?" maand":" maanden"}</T></p><dl className={g.invoice}><T>{value.map(type=><div key={type}><dt><T>{labels[type]}</T><small><T>{money(MONTHLY_PRICES[type])}</T><T>{" × "}</T><T>{months}</T><T>{months===1?" maand":" maanden"}</T></small></dt><dd><T>{money(MONTHLY_PRICES[type]*months)}</T></dd></div>)}</T><div className={g.invoiceTotal}><dt><T>{"Totaal te betalen"}</T></dt><dd><T>{money(total)}</T></dd></div></dl><p className={g.previewNotice}><T>{"Vul hierna je vermelding en factuurgegevens in. Na opslaan betaal je alle gekozen vormen samen via Mollie. Plaatsing volgt na goedkeuring, betaalbevestiging en controle van de beschikbaarheid, binnen je gekozen periode."}</T></p><button type="button" className={g.primary} onClick={()=>{review.current?.close();(document.getElementById('event-details')??document.getElementById('advertiser-details'))?.scrollIntoView({behavior:'smooth',block:'start'});}}><T>{"Verder met mijn vermelding →"}</T></button></dialog>
  <AdvertisingPlacementPreviews value={value} title={title} city={city} category={category} image={image} description={description}/>
 </div>;
}
