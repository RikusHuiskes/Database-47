"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';

type Promotion={id:string;title:string;image_url?:string|null;city?:string|null;short_description?:string|null;description?:string|null};
export default function FloatingPromotions<T extends Promotion>({events,headingId,title,onOpen,suppressed=false}:{events:T[];headingId:string;title:string;onOpen:(event:T)=>void;suppressed?:boolean}){
  const [index,setIndex]=useState(0),[count,setCount]=useState(1),[reduced,setReduced]=useState(false),[wide,setWide]=useState(false),[mounted,setMounted]=useState(false);
  useEffect(()=>{
    const wideViewport=matchMedia('(min-width: 900px)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>{setWide(wideViewport.matches);setCount(wideViewport.matches?2:1);setReduced(motion.matches);};update();setMounted(true);
    wideViewport.addEventListener('change',update);motion.addEventListener('change',update);
    return()=>{wideViewport.removeEventListener('change',update);motion.removeEventListener('change',update);};
  },[]);
  const visible=!suppressed&&events.length>0;
  useEffect(()=>{
    if(!visible||reduced||events.length<=count)return;
    const timer=setInterval(()=>{if(document.visibilityState==='visible')setIndex(value=>(value+count)%events.length);},8000);
    return()=>clearInterval(timer);
  },[visible,reduced,events.length,count]);
  if(!events.length)return null;
  const shown=Array.from({length:Math.min(count,events.length)},(_,offset)=>events[(index+offset)%events.length]);
  const sidebar=<aside className="promotion-sidebar" aria-label="Uitgelichte advertenties" hidden={!visible}>
    <div className="floating-promotion-heading"><div><small className="carousel-kicker">Lokale partners · Advertenties</small><h2 id={headingId}>{title}</h2></div></div>
    <div className="floating-promotion-cards">{shown.map(event=><button className="floating-promotion-card" type="button" key={event.id} onClick={()=>onOpen(event)}>{event.image_url&&/^https?:\/\//i.test(event.image_url)&&<img src={event.image_url} alt=""/>}<span className="floating-promotion-copy"><small className="floating-promotion-label">{headingId==='homepage-promotion-heading'?'Homepagepartner':'Categoriepartner'}{event.city?' · '+event.city:''}</small><strong>{event.title}</strong><span className="floating-promotion-description">{event.short_description||event.description||'Ontdek deze lokale partner en bekijk alle informatie.'}</span><span className="floating-promotion-cta">Ontdek →</span></span></button>)}</div>
    <p className="carousel-position" aria-live="off">{reduced?'Rustige weergave · ':'Wisselt automatisch · '}{index%events.length+1} van {events.length}</p>
  </aside>;
  if(wide&&mounted)return createPortal(sidebar,document.body);
  return <section className="promotion-sidebar-slot" aria-label={title}>{sidebar}</section>;
}
