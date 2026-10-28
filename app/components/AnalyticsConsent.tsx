"use client";
import {useEffect,useState} from 'react';
import {analyticsChoice,enableAnalytics,setAnalyticsChoice,trackAnalytics} from '../../lib/analytics-client';

export default function AnalyticsConsent({disabled}:{disabled:boolean}) {
  const [choice,setChoice]=useState<ReturnType<typeof analyticsChoice>>(null);
  const [ready,setReady]=useState(false);
  const [settings,setSettings]=useState(false);
  useEffect(()=>{
    const refresh=()=>{setChoice(analyticsChoice());setReady(true);};refresh();
    window.addEventListener('analytics-choice',refresh);return()=>window.removeEventListener('analytics-choice',refresh);
  },[]);
  useEffect(()=>{
    const active=!disabled&&choice?.accepted===true;
    enableAnalytics(active);
    if(!active)return;
    trackAnalytics('visit');trackAnalytics('page_view',{page:'/'});window.dispatchEvent(new Event('analytics-ready'));
    const timers=new Map<Element,ReturnType<typeof setTimeout>>();
    const seen=new WeakSet<Element>();
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting||entry.intersectionRatio<0.5){clearTimeout(timers.get(entry.target));timers.delete(entry.target);continue;}
        if(timers.has(entry.target)||seen.has(entry.target))continue;
        timers.set(entry.target,setTimeout(()=>{
          if(document.visibilityState==='visible'){
            const element=entry.target as HTMLElement;
            trackAnalytics('impression',{eventId:element.dataset.analyticsEvent,placement:element.dataset.analyticsPlacement||'standard'});seen.add(element);
          }
          timers.delete(entry.target);
        },1000));
      }
    },{threshold:[0,0.5]});
    const scan=()=>document.querySelectorAll('[data-analytics-event][data-analytics-card]').forEach(el=>observer.observe(el));
    scan();const mutations=new MutationObserver(scan);mutations.observe(document.body,{childList:true,subtree:true});
    const click=(event:MouseEvent)=>{
      const link=(event.target as Element)?.closest('a[data-analytics-channel]') as HTMLElement|null;
      const card=link?.closest('[data-analytics-event]') as HTMLElement|null;
      if(card)trackAnalytics('outbound',{eventId:card.dataset.analyticsEvent,placement:card.dataset.analyticsPlacement||'standard',channel:link!.dataset.analyticsChannel});
    };
    document.addEventListener('click',click);
    return()=>{enableAnalytics(false);observer.disconnect();mutations.disconnect();timers.forEach(clearTimeout);document.removeEventListener('click',click);};
  },[disabled,choice]);
  return <>
    <button className="analytics-settings" type="button" onClick={()=>setSettings(true)}>Statistiekvoorkeuren</button>
    {ready&&!disabled&&(!choice||settings)&&<aside className="analytics-consent" aria-label="Keuze voor statistieken">
      <strong>Help Côte de Duras verbeteren</strong>
      <p>Mogen we bezoeken, bekeken categorieën en klikken meten? Daarmee verbeteren we de agenda en tonen we adverteerders geaggregeerde bereikcijfers. We gebruiken een willekeurige browsercode, bewaren meetgegevens maximaal 13 maanden en slaan geen naam, e-mail of IP-adres op in de statistieken. Uw keuze en browsercode verlopen na 6 maanden. <a href="/statistieken">Meer informatie</a></p>
      <div><button type="button" onClick={()=>{setAnalyticsChoice(false);setSettings(false);}}>Weigeren</button><button type="button" onClick={()=>{setAnalyticsChoice(true);setSettings(false);}}>Toestaan</button></div>
    </aside>}
  </>;
}
