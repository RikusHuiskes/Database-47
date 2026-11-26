"use client";
import {T, A, useLanguage} from '../i18n/Language';

import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import travauxPrivacy from '../../lib/travaux-analytics-privacy.json';
import {isTravauxInteraction,trackTravaux} from '../../lib/travaux-interactions';
import {analyticsChoice,enableAnalytics,setAnalyticsChoice,trackAnalytics} from '../../lib/analytics-client';

export default function AnalyticsConsent({disabled}:{disabled:boolean}) {
  const pathname=usePathname();
  const {locale}=useLanguage();
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
    trackAnalytics('visit');trackAnalytics('page_view',{page:pathname});window.dispatchEvent(new Event('analytics-ready'));
    const timers=new Map<Element,ReturnType<typeof setTimeout>>();
    const seen=new WeakSet<Element>();
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting||entry.intersectionRatio<0.5){clearTimeout(timers.get(entry.target));timers.delete(entry.target);continue;}
        if(timers.has(entry.target)||seen.has(entry.target))continue;
        timers.set(entry.target,setTimeout(()=>{
          if(document.visibilityState==='visible'){
            const element=entry.target as HTMLElement;
            if(element.hasAttribute('data-travaux-card'))trackTravaux('view_job_card');
            else trackAnalytics('impression',{eventId:element.dataset.analyticsEvent,placement:element.dataset.analyticsPlacement||'standard'});
            seen.add(element);
          }
          timers.delete(entry.target);
        },1000));
      }
    },{threshold:[0,0.5]});
    const scan=()=>document.querySelectorAll('[data-analytics-event][data-analytics-card], [data-travaux-card]').forEach(el=>observer.observe(el));
    scan();const mutations=new MutationObserver(scan);mutations.observe(document.body,{childList:true,subtree:true});
    const click=(event:MouseEvent)=>{
      const interaction=(event.target as Element)?.closest('[data-travaux-track]')?.getAttribute('data-travaux-track');
      if(isTravauxInteraction(interaction))trackTravaux(interaction);
      const link=(event.target as Element)?.closest('a[data-analytics-channel]') as HTMLElement|null;
      const anchor=(event.target as Element)?.closest('a[href]') as HTMLAnchorElement|null;
      if(anchor){try{
        const url=new URL(anchor.href);
        if(url.origin===location.origin){
          if(['/adverteren','/gemeentegids/adverteren'].includes(url.pathname))trackAnalytics('advertising_start');
          if(pathname==='/'&&url.pathname==='/travaux'&&!interaction)trackTravaux('site_entry');
        }
      }catch{}}
      const card=link?.closest('[data-analytics-event]') as HTMLElement|null;
      if(card)trackAnalytics('outbound',{eventId:card.dataset.analyticsEvent,placement:card.dataset.analyticsPlacement||'standard',channel:link!.dataset.analyticsChannel});
    };
    const change=(event:Event)=>{
      const element=event.target;
      if(pathname==='/travaux'&&element instanceof HTMLSelectElement&&element.id==='site-language')trackTravaux('language_change');
      if(pathname==='/travaux'&&element instanceof HTMLInputElement&&element.name==='plan'&&element.checked){
        if(element.value==='monthly')trackTravaux('plan_monthly');
        if(element.value==='annual')trackTravaux('plan_annual');
      }
    };
    document.addEventListener('click',click);
    document.addEventListener('change',change);
    return()=>{enableAnalytics(false);observer.disconnect();mutations.disconnect();timers.forEach(clearTimeout);document.removeEventListener('click',click);document.removeEventListener('change',change);};
  },[disabled,choice,pathname]);
  return <>
    <button className="analytics-settings" type="button" onClick={()=>setSettings(true)}><T>{"Statistiekvoorkeuren"}</T></button>
    <T>{ready&&(settings||(!disabled&&!choice))&&<A><aside className="analytics-consent" aria-label="Keuze voor statistieken">
      <strong><T>{"Help Côte de Duras verbeteren"}</T></strong>
      <p><T>{"Mogen we bezoeken, verkeersbronnen, campagnes, land bij benadering en klikken meten? Daarmee verbeteren we de website en onze marketing. We gebruiken een willekeurige browsercode, bewaren meetgegevens maximaal 13 maanden en slaan geen naam, e-mail of IP-adres op in de statistieken. Uw keuze en browsercode verlopen na 6 maanden. "}</T>{pathname==='/travaux'&&<>{travauxPrivacy[locale].consent}{' '}</>}<a href="/statistieken"><T>{"Meer informatie"}</T></a></p>
      <div><button type="button" onClick={()=>{setAnalyticsChoice(false);setSettings(false);}}><T>{"Weigeren"}</T></button><button type="button" onClick={()=>{setAnalyticsChoice(true);setSettings(false);}}><T>{"Toestaan"}</T></button></div>
    </aside></A>}</T>
  </>;
}
