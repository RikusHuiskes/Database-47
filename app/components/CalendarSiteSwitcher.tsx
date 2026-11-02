'use client';
import {T, A} from '../i18n/Language';

import {useId,useState} from 'react';

const sites=[
 {key:'duras',name:['Côte','de','Duras'].join(' '),adminUrl:'https://database-47-git-feature-tourisme-duras-enrichment-rikushuiskes.vercel.app/#beheer',demo:false},
 {key:'libourne',name:'Côte de Libourne',adminUrl:'https://cote-de-libourne.vercel.app/demo-beheer',demo:true},
 {key:'sarlat',name:'Côte de Sarlat',adminUrl:'https://cote-de-sarlat.vercel.app/demo-beheer',demo:true},
];

export default function CalendarSiteSwitcher({currentSite}:{currentSite:string}){
 const active=sites.find(site=>site.key===currentSite);
 if(!active)throw Error('Onbekende beheeromgeving');
 return <CalendarChoice key={active.key} active={active}/>;
}

function CalendarChoice({active}:{active:typeof sites[number]}){
 const id=useId(),[selected,setSelected]=useState(active.key);
 const target=sites.find(site=>site.key===selected)!;
 return <A><section aria-label="Evenementenkalender kiezen" style={{padding:20,margin:'20px 0',border:'2px solid #285542',borderRadius:14,background:'#f1f5ed',color:'#193f37'}}>
  <p style={{margin:'0 0 14px'}}><strong><T>{"Je bewerkt nu: "}</T><T>{active.name}</T></strong><T>{active.demo&&' · demobeheer'}</T></p>
  <div style={{display:'flex',alignItems:'end',gap:12,flexWrap:'wrap'}}>
   <label htmlFor={id} style={{display:'grid',gap:7,flex:'1 1 280px',maxWidth:460,fontWeight:700}}><T>{"Welke evenementenkalender wil je beheren? "}</T><select id={id} value={selected} onChange={event=>setSelected(event.target.value)} style={{width:'100%',padding:12,border:'1px solid #b4c6b6',borderRadius:8,background:'white',color:'#193f37',font:'inherit'}}>
     <T>{sites.map(site=><option key={site.key} value={site.key}><T>{site.name}</T><T>{site.demo?' — demo':''}</T></option>)}</T>
    </select>
   </label>
   <a href={target.adminUrl} style={{display:'inline-block',padding:'13px 18px',borderRadius:9,background:'#285542',color:'white',fontWeight:700,textDecoration:'none'}}><T>{"Open beheer van "}</T><T>{target.name}</T><T>{" →"}</T></a>
  </div>
  <p style={{margin:'12px 0 0',fontSize:14}}><T>{"Je opent de eigen beheermodule van de gekozen website. Vermeldingen worden niet tussen websites verplaatst."}</T><T>{target.demo?' Deze kalender is een kosteloos voorbeeld; wijzigingen blijven lokaal in je browser.':' Voor deze kalender gebruik je de bestaande beheerderslogin.'}</T></p>
 </section></A>;
}
