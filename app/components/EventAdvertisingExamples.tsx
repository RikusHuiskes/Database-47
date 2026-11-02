"use client";
import {MONTHLY_PRICES,type AdvertisingType} from '../../lib/advertising';
import s from './event-advertising-examples.module.css';

type Choice='none'|AdvertisingType;
type Props={value:Choice;onChange:(value:Choice)=>void;title:string;city:string;category:string;image:string};
const labels:Record<Choice,string>={none:'Gratis vermelding',highlight:'Vetomrande vermelding',category:'Categorieadvertentie',homepage:'Homepageadvertentie'};
const descriptions:Record<Choice,string>={none:'Je vermelding verschijnt na goedkeuring tussen de gewone resultaten.',highlight:'Een dikke donkergroene rand en bovenaan de zoekresultaten.',category:'Een extra advertentiekaart in de rechterkolom bij jouw categorie.',homepage:'Een extra advertentiekaart in de rechterkolom op de homepage.'};
const choices:Choice[]=['none','highlight','category','homepage'];
const money=(cents:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100);
export default function EventAdvertisingExamples({value,onChange,title,city,category,image}:Props){
 const name=title.trim()||'Jouw evenement of vermelding',place=city.trim()||'Duras & omgeving',rubric=category||'Jouw categorie';
 const photo=/^(blob:|https?:\/\/)/i.test(image)?image:'';
 const visual=photo?<img src={photo} alt=""/>:<div className={s.photo}><span aria-hidden="true">✦</span><small>Jouw foto komt hier</small></div>;
 const card=(highlighted:boolean)=> <article className={`${s.card} ${highlighted?s.highlight:''}`}>
  {highlighted&&<div className={s.banner}>Advertentie · Uitgelichte vermelding</div>}{visual}<div className={s.copy}><small>{rubric} · {place}</small><h4>{name}</h4><p>Je foto, evenementinformatie en contactgegevens blijven bij dezelfde vermelding staan.</p><span className={s.link}>Bekijk evenementdetails →</span></div>
 </article>;
 return <div className={s.root}>
  <div className={s.choices}>{choices.map(type=><label className={`${s.choice} ${value===type?s.selected:''}`} key={type}>
   <span className={s.heading}><input type="radio" name="promotion-type" value={type} checked={value===type} onChange={()=>onChange(type)} aria-controls="event-advertising-example"/><strong>{labels[type]}</strong></span>
   <span className={`${s.sample} ${type==='highlight'?s.sampleHighlight:''}`} aria-hidden="true">{type!=='none'&&<small>{type==='highlight'?'Uitgelichte advertentie':type==='category'?'Categoriepartner':'Homepagepartner'}</small>}<strong>{name}</strong><span>{type==='homepage'?'Op de homepage':rubric+' · '+place}</span></span>
   <span className={s.description}>{descriptions[type]}</span><strong className={s.price}>{type==='none'?'Gratis':money(MONTHLY_PRICES[type])+' / maand'}</strong><span className={s.selection}>{value===type?'✓ Gekozen':'Kies deze vorm'}</span>
  </label>)}</div>
  <section id="event-advertising-example" className={s.example} aria-labelledby="event-example-heading">
   <p className={s.kicker}>Door de ogen van de bezoeker</p><h3 id="event-example-heading">Zo ziet jouw vermelding eruit</h3><p>Vul verderop je titel, plaats en categorie in en voeg een foto toe. Je voorbeeld verandert mee.</p>
   <div className={s.layout}><div><h4>{value==='highlight'?'Bovenaan de zoekresultaten':'Tussen de gewone resultaten'}</h4>{value!=='highlight'&&<div className={s.other}>Andere vermelding · voorbeeld</div>}{card(value==='highlight')}{value==='highlight'&&<div className={s.other}>Gewone vermelding · voorbeeld</div>}</div>
    <aside className={s.sidebar}><small>Lokale partners · Advertenties</small><h4>{value==='homepage'?'Uitgelicht op de homepage':value==='category'?'Uitgelicht in '+rubric:'De rechterkolom'}</h4>{value==='category'||value==='homepage'?<article className={s.card}>{visual}<div className={s.copy}><small>{value==='homepage'?'Homepagepartner':'Categoriepartner'} · {place}</small><h4>{name}</h4><p>Ontdek deze vermelding en bekijk alle informatie.</p><span className={s.link}>Ontdek →</span></div></article>:<p className={s.empty}>Met een categorie- of homepageadvertentie verschijnt jouw vermelding ook hier.</p>}</aside>
   </div>
   <p className={s.note} role="status">{descriptions[value]}{(value==='category'||value==='homepage')&&' Je vermelding blijft daarnaast ook tussen de gewone resultaten staan.'} Dit is een visueel voorbeeld, geen actieve advertentie. Betaalde plaatsing volgt na goedkeuring en betaalbevestiging, binnen de gekozen periode en bij beschikbare ruimte.</p>
  </section>
 </div>;
}
