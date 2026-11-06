'use client';
import {useEffect,useRef,useState} from 'react';
import {T} from '../i18n/Language';
import areas from '../../lib/data/area-catalog.json';
import type {ManagementTarget} from '../../lib/management-navigation';
type Result=ManagementTarget&{address?:string;start_at?:string;is_directory_entry?:boolean};
export default function ListingFinder({onSelect}:{onSelect:(target:ManagementTarget)=>void}){
 const [q,setQ]=useState(''),[city,setCity]=useState(''),[source,setSource]=useState('events');
 const [results,setResults]=useState<Result[]>([]),[hasMore,setHasMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[searched,setSearched]=useState(false);
 const [submitted,setSubmitted]=useState<{q:string;city:string;source:string;page:number}|null>(null);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function search(next={q,city,source,page:0}){
  controller.current?.abort();const active=new AbortController();controller.current=active;setBusy(true);setError('');
  try{
   const response=await fetch('/api/listing-search?'+new URLSearchParams({...next,page:String(next.page)}),{signal:active.signal,cache:'no-store'});
   const data=await response.json();if(!response.ok)throw Error(data.error);
   setResults(data.results);setHasMore(data.hasMore);setSubmitted(next);setSearched(true);
  }catch(e){if(!active.signal.aborted){setError(e instanceof Error?e.message:'Zoeken mislukt.');setResults([]);setHasMore(false);setSubmitted(null);}}
  finally{if(!active.signal.aborted)setBusy(false);}
 }
 return <section aria-labelledby="listing-search-heading">
  <h2 id="listing-search-heading"><T>Zoek je bestaande vermelding</T></h2>
  <p><T>Kies je vermelding om beheer aan te vragen of een correctie door te geven. Een aanvraag geeft nog geen wijzigingsrechten.</T></p>
  <form className="owner-form" onSubmit={e=>{e.preventDefault();void search();}}>
   <label><T>Zoeken in</T><select value={source} onChange={e=>setSource(e.target.value)}><option value="events"><T>Evenementenkalender</T></option><option value="directory"><T>Gemeentegids</T></option></select></label>
   <label><T>Naam van je evenement of bedrijf</T><input required minLength={2} maxLength={120} value={q} onChange={e=>setQ(e.target.value)}/></label>
   <label><T>{source==='directory'?'Plaats *':'Plaats (optioneel)'}</T><input list="owner-search-towns" required={source==='directory'} maxLength={150} value={city} onChange={e=>setCity(e.target.value)}/><datalist id="owner-search-towns">{areas.areas.map(area=><option key={area.id} value={area.name}/>)}</datalist></label>
   <button disabled={busy}><T>{busy?'Zoeken…':'Zoek mijn vermelding'}</T></button>
  </form>
  {error&&<p role="alert"><T>{error}</T></p>}
  {searched&&!busy&&!error&&results.length===0&&<p role="status"><T>Geen openbare vermelding gevonden. Probeer een deel van de naam. Voor een nog niet goedgekeurde inzending gebruik je je persoonlijke beheerlink.</T></p>}
  <ul className="owner-search-results">{results.map(item=><li key={item.id||item.serviceId}><div><strong><T>{item.title}</T></strong><p><T preserve>{[item.city,item.address].filter(Boolean).join(' · ')}</T></p>{item.start_at&&!item.is_directory_entry&&<small>{item.start_at.slice(0,10)}</small>}</div><button type="button" disabled={busy} onClick={()=>onSelect(item)}><T>Kies deze vermelding</T></button></li>)}</ul>
  {submitted&&(submitted.page>0||hasMore)&&<div className="management-link-actions"><button disabled={busy||submitted.page===0} onClick={()=>void search({...submitted,page:submitted.page-1})}><T>Vorige</T></button><span><T>Pagina</T> {submitted.page+1}</span><button disabled={busy||!hasMore} onClick={()=>void search({...submitted,page:submitted.page+1})}><T>Volgende</T></button></div>}
 </section>;
}
