"use client";
import {useEffect,useState} from 'react';

type Promotion={id:string;title:string;image_url?:string|null;city?:string|null;short_description?:string|null;description?:string|null};
export default function FloatingPromotions<T extends Promotion>({events,headingId,title,onOpen,suppressed=false}:{events:T[];headingId:string;title:string;onOpen:(event:T)=>void;suppressed?:boolean}){
  const [closed,setClosed]=useState(false),[index,setIndex]=useState(0),[count,setCount]=useState(1),[paused,setPaused]=useState(false),[interacting,setInteracting]=useState(false),[reduced,setReduced]=useState(false);
  useEffect(()=>{
    const wide=matchMedia('(min-width: 1100px)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>{setCount(wide.matches?2:1);setReduced(motion.matches);};update();
    wide.addEventListener('change',update);motion.addEventListener('change',update);
    return()=>{wide.removeEventListener('change',update);motion.removeEventListener('change',update);};
  },[]);
  const visible=!closed&&!suppressed&&events.length>0;
  useEffect(()=>{
    if(!visible||paused||interacting||reduced||events.length<=count)return;
    const timer=setInterval(()=>{if(document.visibilityState==='visible')setIndex(value=>(value+count)%events.length);},8000);
    return()=>clearInterval(timer);
  },[visible,paused,interacting,reduced,events.length,count]);
  if(!events.length)return null;
  const shown=Array.from({length:Math.min(count,events.length)},(_,offset)=>events[(index+offset)%events.length]);
  return <section className="promotion-sidebar-slot" aria-label={title}>{closed&&!suppressed&&<button className="promotion-sidebar-reopen" type="button" onClick={()=>setClosed(false)}>Uitgelichte partners tonen →</button>}<aside className="promotion-sidebar" aria-label="Uitgelichte advertenties" hidden={!visible} onMouseEnter={()=>setInteracting(true)} onMouseLeave={()=>setInteracting(false)} onFocusCapture={()=>setInteracting(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setInteracting(false);}}>
    <div className="floating-promotion-heading"><div><small className="carousel-kicker">Lokale partners · Advertenties</small><h2 id={headingId}>{title}</h2></div><div><button type="button" onClick={()=>setIndex(value=>(value-count+events.length)%events.length)} aria-label="Vorige advertenties">←</button><button type="button" onClick={()=>setPaused(value=>!value)} aria-pressed={paused}>{paused?'Afspelen':'Pauzeren'}</button><button type="button" onClick={()=>setIndex(value=>(value+count)%events.length)} aria-label="Volgende advertenties">→</button><button type="button" onClick={()=>setClosed(true)} aria-label="Advertentiebalk sluiten">✕</button></div></div>
    <div className="floating-promotion-cards">{shown.map(event=><button className="floating-promotion-card" type="button" key={event.id} onClick={()=>onOpen(event)}>{event.image_url&&/^https?:\/\//i.test(event.image_url)&&<img src={event.image_url} alt=""/>}<span className="floating-promotion-copy"><small className="floating-promotion-label">{headingId==='homepage-promotion-heading'?'Homepagepartner':'Categoriepartner'}{event.city?' · '+event.city:''}</small><strong>{event.title}</strong><span className="floating-promotion-description">{event.short_description||event.description||'Ontdek deze lokale partner en bekijk alle informatie.'}</span><span className="floating-promotion-cta">Ontdek →</span></span></button>)}</div>
    <p className="carousel-position" aria-live="off">{index%events.length+1} van {events.length} · Blader met de pijlen</p>
  </aside></section>;
}
