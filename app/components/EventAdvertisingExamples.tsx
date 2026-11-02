"use client";
import {MONTHLY_PRICES,type AdvertisingType} from '../../lib/advertising';
import s from './event-advertising-examples.module.css';

type Choice='none'|AdvertisingType;
type Props={value:AdvertisingType[];onChange:(value:AdvertisingType[])=>void;months:number;title:string;city:string;category:string;image:string};
const labels:Record<Choice,string>={none:'Gratis vermelding',highlight:'Vetomrande vermelding',category:'Categorieadvertentie',homepage:'Homepageadvertentie'};
const descriptions:Record<Choice,string>={none:'Je vermelding verschijnt na goedkeuring tussen de gewone resultaten.',highlight:'Een dikke donkergroene rand en bovenaan de zoekresultaten.',category:'Een extra advertentiekaart in de rechterkolom bij jouw categorie.',homepage:'Een extra advertentiekaart in de rechterkolom op de homepage.'};
const choices:Choice[]=['none','highlight','category','homepage'];
const money=(cents:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100);
export default function EventAdvertisingExamples({value,onChange,months,title,city,category,image}:Props){
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
  <p>Vink één, twee of drie advertentievormen aan. Alle gekozen vormen gaan samen in één betaling. Zonder betaalde keuze blijft je vermelding gratis.</p>
  <div className={s.choices}>{choices.map(type=><label className={`${s.choice} ${chosen(type)?s.selected:''}`} key={type}>
   <span className={s.heading}><input type="checkbox" name="promotion-type" value={type} checked={chosen(type)} onChange={()=>toggle(type)} aria-controls="event-advertising-example"/><strong>{labels[type]}</strong></span>
   <span className={`${s.sample} ${type==='highlight'?s.sampleHighlight:''}`} aria-hidden="true">{type!=='none'&&<small>{type==='highlight'?'Uitgelichte advertentie':type==='category'?'Categoriepartner':'Homepagepartner'}</small>}<strong>{name}</strong><span>{type==='homepage'?'Op de homepage':rubric+' · '+place}</span></span>
   <span className={s.description}>{descriptions[type]}</span><strong className={s.price}>{type==='none'?'Gratis':money(MONTHLY_PRICES[type])+' / maand'}</strong><span className={s.selection}>{chosen(type)?'✓ Gekozen':type==='none'?'Alleen gratis vermelden':'Voeg toe aan je keuze'}</span>
  </label>)}</div>
  <div className={s.total} aria-live="polite"><strong>{value.length?`${value.length} advertentievorm${value.length===1?'':'en'} · ${money(value.reduce((sum,type)=>sum+MONTHLY_PRICES[type],0)*months)} totaal`:'Gratis vermelding · geen advertentiekosten'}</strong><span>{value.length?`${months} maand${months===1?'':'en'} · één gezamenlijke betaling via Mollie`:'Kies hierboven eventueel extra zichtbaarheid.'}</span></div>
  <section id="event-advertising-example" className={s.example} aria-labelledby="event-example-heading">
   <p className={s.kicker}>Door de ogen van de bezoeker</p><h3 id="event-example-heading">Zo ziet jouw vermelding eruit</h3><p>Vul verderop je titel, plaats en categorie in en voeg een foto toe. Je voorbeeld verandert mee.</p>
   <div className={s.layout}><div><h4>{bold?'Bovenaan de zoekresultaten':'Tussen de gewone resultaten'}</h4>{!bold&&<div className={s.other}>Andere vermelding · voorbeeld</div>}{card(bold)}{bold&&<div className={s.other}>Gewone vermelding · voorbeeld</div>}</div>
    <aside className={s.sidebar}><small>Lokale partners · Advertenties</small><h4>Jouw gekozen extra zichtbaarheid</h4>{partners.length?partners.map(type=><div key={type}><h4>{type==='homepage'?'Op de homepage':'Binnen '+rubric}</h4><article className={s.card}>{visual}<div className={s.copy}><small>{type==='homepage'?'Homepagepartner':'Categoriepartner'} · {place}</small><h4>{name}</h4><p>Ontdek deze vermelding en bekijk alle informatie.</p><span className={s.link}>Ontdek →</span></div></article></div>):<p className={s.empty}>Met een categorie- of homepageadvertentie verschijnt jouw vermelding ook hier.</p>}</aside>
   </div>
   <p className={s.note} role="status">{value.length?value.map(type=>descriptions[type]).join(' '):descriptions.none} Je vermelding blijft tussen de gewone resultaten staan. Dit is een visueel voorbeeld, geen actieve advertentie. Betaalde plaatsing volgt na goedkeuring en betaalbevestiging, binnen de gekozen periode en bij beschikbare ruimte.</p>
  </section>
 </div>;
}
