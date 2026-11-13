'use client';
import {Children,cloneElement,createContext,isValidElement,useContext,useEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactElement,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {LOCALE_COOKIE,localeFrom,normalizeMessage,createTranslator,messageKey,type Dictionary,type Locale} from '../../lib/i18n';
import {publicEventText} from '../../lib/public-event-links';
import nl from './messages/nl.json';
import en from './messages/en.json';
import fr from './messages/fr.json';
import monthlyBilling from './messages/reviewed-monthly-billing.json';
import publicKeys from '../../lib/translations/content-index.json';
import './language.css';
type LanguageContext={locale:Locale;setLocale:(locale:Locale)=>void;t:(text:string)=>string};
const dictionaries:Record<Locale,Dictionary>={
 nl:{...nl,...Object.fromEntries(monthlyBilling.map(row=>[row[0],row[0]]))},
 en:{...en,...Object.fromEntries(monthlyBilling.map(row=>[row[0],row[1]]))},
 fr:{...fr,...Object.fromEntries(monthlyBilling.map(row=>[row[0],row[2]]))}
};
const knownPublicKeys=new Set(publicKeys);
const Context=createContext<LanguageContext>({locale:'fr',setLocale:()=>{},t:text=>text});
const contentCache:Record<Locale,Map<string,string|null>>={nl:new Map(),en:new Map(),fr:new Map()};
const queues:Record<Locale,Set<string>>={nl:new Set(),en:new Set(),fr:new Set()};
const listeners=new Set<()=>void>();let revision=0;
const subscribe=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
const snapshot=()=>revision,serverSnapshot=()=>0;
const scheduled=new Set<Locale>();
function queueContent(locale:Locale,keys:string[]){
 for(const key of keys)if(knownPublicKeys.has(key)&&!contentCache[locale].has(key))queues[locale].add(key);
 if(!queues[locale].size||scheduled.has(locale))return;scheduled.add(locale);
 setTimeout(async()=>{const keys=[...queues[locale]].slice(0,100);keys.forEach(key=>queues[locale].delete(key));try{const response=await fetch('/api/content-translations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({locale,keys})});if(!response.ok)throw Error('Translation lookup failed');const data=await response.json() as {translations:Record<string,string>};for(const key of keys)contentCache[locale].set(key,typeof data.translations[key]==='string'?data.translations[key]:null);revision++;listeners.forEach(listener=>listener());}catch{/* Keep the original public text on a network failure. Retry on the next render. */}finally{scheduled.delete(locale);if(queues[locale].size)queueContent(locale,[]);}},30);
}
export function LanguageProvider({initialLocale,children}:{initialLocale:Locale;children:ReactNode}){
 const [locale,setLanguage]=useState(initialLocale),router=useRouter();
 const setLocale=(next:Locale)=>{setLanguage(next);document.documentElement.lang=next;document.cookie=`${LOCALE_COOKIE}=${next}; Path=/; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;router.refresh();};
 useEffect(()=>{document.documentElement.lang=locale;},[locale]);
 const t=useMemo(()=>createTranslator(locale,dictionaries[locale]),[locale]);
 return <Context.Provider value={{locale,setLocale,t}}><LanguageMenu/>{children}</Context.Provider>;
}
export function useLanguage(){return useContext(Context);}
function LanguageMenu(){
 const {locale,setLocale}=useLanguage(),bar=useRef<HTMLDivElement>(null);
 useEffect(()=>{const node=bar.current;if(!node)return;const measure=()=>document.documentElement.style.setProperty('--site-language-bar-height',Math.ceil(node.getBoundingClientRect().height)+'px');measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[]);
 return <div className="site-language-bar" ref={bar}><div><span aria-hidden="true">◎</span><label htmlFor="site-language">{locale==='fr'?'Langue':locale==='en'?'Language':'Taal'}</label><select id="site-language" value={locale} onChange={event=>setLocale(localeFrom(event.target.value))} aria-label={locale==='fr'?'Choisir la langue':locale==='en'?'Choose language':'Kies je taal'}><option value="fr" lang="fr">Français</option><option value="en" lang="en">English</option><option value="nl" lang="nl">Nederlands</option></select></div></div>;
}
/** No extra DOM, so labels, options, tables and accessible form relationships are preserved. */
export function T({children,preserve=false}:{children:ReactNode;preserve?:boolean}){
 const {t,locale}=useLanguage();useSyncExternalStore(subscribe,snapshot,serverSnapshot);
 const keys:string[]=[];
 if(!preserve)Children.forEach(children,child=>{if(typeof child==='string'&&child.trim()){const key=messageKey(child);if(knownPublicKeys.has(key))keys.push(key);}});
 const requested=keys.join(',');useEffect(()=>{queueContent(locale,requested?requested.split(','):[]);},[locale,requested]);
 return <>{Children.map(children,child=>{
  if(preserve||typeof child!=='string')return child;
  const key=messageKey(child);
  if(knownPublicKeys.has(key))return publicEventText(contentCache[locale].get(key)??child);
  return publicEventText(t(child));
 })}</>;
}
/** Translate display attributes without touching input values, links, IDs or handlers. */
export function A({children}:{children:ReactElement}){const {t}=useLanguage();if(!isValidElement(children))return children;const props=children.props as Record<string,unknown>,translated:Record<string,string>={};for(const key of ['placeholder','title','alt','aria-label','aria-description'])if(typeof props[key]==='string')translated[key]=t(props[key]);return cloneElement(children,translated);}
