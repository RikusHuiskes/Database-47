"use client";
import {useEffect,useState} from 'react';

type Promotion={id:string;title:string;image_url?:string|null;city?:string|null};
export default function FloatingPromotions<T extends Promotion>({events,headingId,onOpen,suppressed=false}:{events:T[];headingId:string;onOpen:(event:T)=>void;suppressed?:boolean}){
  const [past,setPast]=useState(false),[closed,setClosed]=useState(false),[index,setIndex]=useState(0),[count,setCount]=useState(1),[paused,setPaused]=useState(false),[interacting,setInteracting]=useState(false),[reduced,setReduced]=useState(false);
  useEffect(()=>{
    const wide=matchMedia('(min-width: 900px)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>{setCount(wide.matches?3:1);setReduced(motion.matches);};update();
    wide.addEventListener('change',update);motion.addEventListener('change',update);
    return()=>{wide.removeEventListener('change',update);motion.removeEventListener('change',update);};
  },[]);
  useEffect(()=>{
    const section=document.getElementById(headingId)?.closest('section');if(!section)return;
    const update=()=>setPast(section.getBoundingClientRect().bottom<=0);
    const observer=new IntersectionObserver(update);observer.observe(section);update();
    return()=>observer.disconnect();
  },[headingId,events.length]);
  const visible=past&&!closed&&!suppressed&&events.length>0;
  useEffect(()=>{
    if(!visible||paused||interacting||reduced||events.length<=count)return;
    const timer=setInterval(()=>{if(document.visibilityState==='visible')setIndex(value=>(value+count)%events.length);},8000);
    return()=>clearInterval(timer);
  },[visible,paused,interacting,reduced,events.length,count]);
  if(!visible)return null;
  const shown=Array.from({length:Math.min(count,events.length)},(_,offset)=>events[(index+offset)%events.length]);
  return <aside className="floating-promotions" aria-label="Uitgelichte advertenties" onMouseEnter={()=>setInteracting(true)} onMouseLeave={()=>setInteracting(false)} onFocusCapture={()=>setInteracting(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setInteracting(false);}}>
    <div className="floating-promotion-heading"><span>Uitgelicht · Advertenties</span><div><button type="button" onClick={()=>setIndex(value=>(value-count+events.length)%events.length)} aria-label="Vorige advertenties">←</button><button type="button" onClick={()=>setPaused(value=>!value)} aria-pressed={paused}>{paused?'Afspelen':'Pauzeren'}</button><button type="button" onClick={()=>setIndex(value=>(value+count)%events.length)} aria-label="Volgende advertenties">→</button><button type="button" onClick={()=>setClosed(true)} aria-label="Advertentiebalk sluiten">✕</button></div></div>
    <div className="floating-promotion-cards">{shown.map(event=><button className="floating-promotion-card" type="button" key={event.id} onClick={()=>onOpen(event)}>{event.image_url&&/^https?:\/\//i.test(event.image_url)&&<img src={event.image_url} alt=""/>}<span><strong>{event.title}</strong><small>{event.city} · Bekijk →</small></span></button>)}</div>
  </aside>;
}
