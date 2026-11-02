"use client";
import {MONTHLY_PRICES,type AdvertisingType} from '../../lib/advertising';
import {useRef} from 'react';
import g from '../gemeentegids/adverteren/preview.module.css';
import s from './event-advertising-examples.module.css';

type Choice='none'|AdvertisingType;
type Props={value:AdvertisingType[];onChange:(value:AdvertisingType[])=>void;months:number;onMonthsChange:(months:number)=>void;title:string;city:string;category:string;image:string};
const labels:Record<Choice,string>={none:'Gratis vermelding',highlight:'Vetomrande vermelding',category:'Categorieadvertentie',homepage:'Homepageadvertentie'};
const descriptions:Record<Choice,string>={none:'Je vermelding verschijnt na goedkeuring tussen de gewone resultaten.',highlight:'Een dikke donkergroene rand en bovenaan de zoekresultaten.',category:'Een extra advertentiekaart in de rechterkolom bij jouw categorie.',homepage:'Een extra advertentiekaart in de rechterkolom op de homepage.'};
const choices:AdvertisingType[]=['highlight','category','homepage'];
const eyebrows={highlight:'Bovenaan de resultaten',category:'Extra zichtbaar in jouw categorie',homepage:'Bereik bezoekers op de homepage'};
const explanations={highlight:'Je vermelding krijgt een donkergroene rand en staat bovenaan de zoekresultaten binnen je gekozen categorie.',category:'Een eigen advertentiekaart in de rechterkolom bij jouw categorie, naast je gewone vermelding.',homepage:'Je advertentie is zichtbaar in de rechterkolom op de homepage. Je vermelding blijft ook in de gewone resultaten staan.'};
const money=(cents:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100);
export default function EventAdvertisingExamples({value,onChange,months,onMonthsChange,title,city,category,image}:Props){
 const review=useRef<HTMLDialogElement>(null);
 const total=value.reduce((sum,type)=>sum+MONTHLY_PRICES[type]*months,0);
 const chosen=(type:Choice)=>type==='none'?value.length===0:value.includes(type);
 const toggle=(type:Choice)=>onChange(type==='none'?[]:chosen(type)?value.filter(item=>item!==type):[...value,type]);
 const bold=value.includes('highlight'),partners=value.filter(type=>type!=='highlight');
 const name=title.trim()||'Jouw evenement of vermelding',place=city.trim()||'Duras & omgeving',rubric=category||'Jouw categorie';
 const photo=/^(blob:|https?:\/\/)/i.test(image)?image:'';
 const visual=photo?<img src={photo} alt=""/>:<div className={s.photo}><span aria-hidden="true">✦</span><small>Jouw foto komt hier</small></div>;
 const card=(highlighted:boolean)=> <article className={`${s.card} ${highlighted?s.highlight:''}`}>
  {highlighted&&<div className={s.banner}>Advertentie · Uitgelichte vermelding</div>}{visual}<div className={s.copy}><small>{rubric} · {place}</small><h4>{name}</h4><p>Je foto, evenementinformatie en contactgegevens blijven bij dezelfde vermelding staan.</p><span className={s.link}>Bekijk evenementdetails →</span></div>
 </article>;
 return <div className={s.root}>
  <div className={g.sectionHeading}><div><p className={g.kicker}>01 · Jouw advertentie</p><h3 className={s.choiceHeading}>Hoe wil je opvallen?</h3></div><span className={g.priceNote}>Tarieven · per maand</span></div>
  <p>Vink één, twee of drie advertentievormen aan. Bekijk wat je koopt en betaal alle gekozen vormen samen in één keer.</p>
  <div className={g.choices}>{choices.map(type=><label className={g.choice+' '+(chosen(type)?g.selected:'')} key={type}>
   <span className={g.choiceTitle}><input type="checkbox" name="promotion-type" value={type} checked={chosen(type)} onChange={()=>toggle(type)} aria-controls="event-advertising-example"/><strong>{labels[type]}</strong></span>
   <small className={g.eyebrow}>{eyebrows[type]}</small>
   <span className={g.sample+' '+(type==='highlight'?g.sampleBold:g.samplePartner)} aria-hidden="true">{type!=='highlight'&&<span className={g.sampleScope}>{type==='category'?rubric:'Homepage'} · Partners</span>}<span className={g.sampleBadge}>Advertentie</span><strong>{name}</strong><small>{rubric} · {place}</small></span>
   <p>{explanations[type]}</p><span className={g.price}><strong>{money(MONTHLY_PRICES[type])}</strong><span>/ maand</span></span><span className={g.selectionLabel}>{chosen(type)?'✓ Toegevoegd aan je keuze':'Voeg toe aan je keuze'}</span>
  </label>)}</div>
  <div className={g.selectionBar}><label>Looptijd<select aria-label="Looptijd advertentie" value={months} onChange={event=>onMonthsChange(Number(event.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1} {i===0?'maand':'maanden'}</option>)}</select></label><div aria-live="polite"><small>{value.length} advertentievorm{value.length===1?'':'en'} · {months} maand{months===1?'':'en'}</small><strong>{money(total)} <span>totaal</span></strong></div><button type="button" className={g.primary} disabled={!value.length} onClick={()=>review.current?.showModal()}>Bekijk betaaloverzicht →</button></div>
  <label className={s.freeChoice}><input type="checkbox" name="promotion-type" value="none" checked={chosen('none')} onChange={()=>toggle('none')}/><span><strong>Gratis vermelding</strong> · Liever alleen een gewone vermelding? Hiermee wis je de betaalde keuzes.</span></label>
  <dialog ref={review} className={g.dialog} aria-labelledby="event-ad-review-heading"><button type="button" className={g.close} aria-label="Betaaloverzicht sluiten" onClick={()=>review.current?.close()}>×</button><span className={g.pill}>Eén gezamenlijke betaling</span><h2 id="event-ad-review-heading">Jouw advertentieoverzicht</h2><p><strong>{name}</strong><br/>{rubric} · {place} · {months} maand{months===1?'':'en'}</p><dl className={g.invoice}>{value.map(type=><div key={type}><dt>{labels[type]}<small>{money(MONTHLY_PRICES[type])} × {months} maand{months===1?'':'en'}</small></dt><dd>{money(MONTHLY_PRICES[type]*months)}</dd></div>)}<div className={g.invoiceTotal}><dt>Totaal te betalen</dt><dd>{money(total)}</dd></div></dl><p className={g.previewNotice}>Vul hierna je vermelding en factuurgegevens in. Na opslaan betaal je alle gekozen vormen samen via Mollie. Plaatsing volgt na goedkeuring, betaalbevestiging en controle van de beschikbaarheid, binnen je gekozen periode.</p><button type="button" className={g.primary} onClick={()=>{review.current?.close();document.getElementById('advertiser-details')?.scrollIntoView({behavior:'smooth',block:'start'});}}>Verder met mijn vermelding →</button></dialog>
  <section id="event-advertising-example" className={s.example} aria-labelledby="event-example-heading">
   <p className={s.kicker}>Door de ogen van de bezoeker</p><h3 id="event-example-heading">Zo ziet jouw vermelding eruit</h3><p>Vul verderop je titel, plaats en categorie in en voeg een foto toe. Je voorbeeld verandert mee.</p>
   <div className={s.layout}><div><h4>{bold?'Bovenaan de zoekresultaten':'Tussen de gewone resultaten'}</h4>{!bold&&<div className={s.other}>Andere vermelding · voorbeeld</div>}{card(bold)}{bold&&<div className={s.other}>Gewone vermelding · voorbeeld</div>}</div>
    <aside className={s.sidebar}><small>Lokale partners · Advertenties</small><h4>Jouw gekozen extra zichtbaarheid</h4>{partners.length?partners.map(type=><div key={type}><h4>{type==='homepage'?'Op de homepage':'Binnen '+rubric}</h4><article className={s.card}>{visual}<div className={s.copy}><small>{type==='homepage'?'Homepagepartner':'Categoriepartner'} · {place}</small><h4>{name}</h4><p>Ontdek deze vermelding en bekijk alle informatie.</p><span className={s.link}>Ontdek →</span></div></article></div>):<p className={s.empty}>Met een categorie- of homepageadvertentie verschijnt jouw vermelding ook hier.</p>}</aside>
   </div>
   <p className={s.note} role="status">{value.length?value.map(type=>descriptions[type]).join(' '):descriptions.none} Je vermelding blijft tussen de gewone resultaten staan. Dit is een visueel voorbeeld, geen actieve advertentie. Betaalde plaatsing volgt na goedkeuring en betaalbevestiging, binnen de gekozen periode en bij beschikbare ruimte.</p>
  </section>
 </div>;
}
