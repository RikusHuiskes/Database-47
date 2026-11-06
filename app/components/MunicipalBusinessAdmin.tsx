"use client";
import {T,useLanguage} from '../i18n/Language';
import {useEffect,useState,type FormEvent} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {MunicipalAdminItem as Item} from '../../lib/municipal-admin-catalog';
import areaData from '../../lib/data/area-catalog.json';
import {MUNICIPAL_BUSINESS_LABELS} from '../../lib/municipal-shops';
import s from './MunicipalBusinessAdmin.module.css';
export default function MunicipalBusinessAdmin({client}:{client:SupabaseClient|null}){
 const {t,locale}=useLanguage();
 const [cityFilter,setCityFilter]=useState(''),[typeFilter,setTypeFilter]=useState(''),[statusFilter,setStatusFilter]=useState('');
 const [open,setOpen]=useState(false),[items,setItems]=useState<Item[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[editing,setEditing]=useState<Item|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  if(!open||!client)return;
  const controller=new AbortController();setLoading(true);setMessage('');
  void(async()=>{try{
   const session=await client.auth.getSession();
   if(!session.data.session)throw Error('Beheerderstoegang vereist.');
   const response=await fetch('/api/admin/municipal-listings?'+new URLSearchParams({page:String(page),code:cityFilter,type:typeFilter,status:statusFilter}),{headers:{Authorization:'Bearer '+session.data.session.access_token},cache:'no-store',signal:controller.signal});
   const data=await response.json();if(!response.ok)throw Error(data.error);
   if(!controller.signal.aborted){setItems(data.items);setTotal(data.total);}
  }catch(e){if(!controller.signal.aborted){setItems([]);setTotal(0);setMessage(e instanceof Error?e.message:'Laden mislukt.');}}
  finally{if(!controller.signal.aborted)setLoading(false);}})();
  return()=>controller.abort();
 },[open,page,client,cityFilter,typeFilter,statusFilter,refresh]);
 async function review(id:string,decision:'approved'|'rejected'){
  if(!client)return;setBusy(true);setMessage('');
  try{const session=await client.auth.getSession();const response=await fetch('/api/admin/municipal-listings',{method:'POST',headers:{Authorization:'Bearer '+session.data.session?.access_token,'Content-Type':'application/json'},body:JSON.stringify({id,action:'review',decision})});const data=await response.json();if(!response.ok)throw Error(data.error);setEditing(null);setRefresh(value=>value+1);}catch(error){setMessage(error instanceof Error?error.message:'Opslaan mislukt.');}finally{setBusy(false);}
 }
 async function save(e:FormEvent){
  e.preventDefault();if(!client||!editing)return;setBusy(true);setMessage('');
  try{const session=await client.auth.getSession();const r=await fetch('/api/admin/municipal-listings',{method:'POST',headers:{Authorization:'Bearer '+session.data.session?.access_token,'Content-Type':'application/json'},body:JSON.stringify(editing)});const data=await r.json();if(!r.ok)throw Error(data.error);setItems(previous=>previous.map(item=>item.id===editing.id?{...editing,id:data.id}:item));setEditing(null);setMessage('Bedrijfsgegevens opgeslagen.');}catch(e){setMessage(e instanceof Error?e.message:'Opslaan mislukt.');}finally{setBusy(false);}
 }
 function changeFilter(kind:'city'|'type',value:string){if(kind==='city')setCityFilter(value);else setTypeFilter(value);setPage(1);setEditing(null);}
 return <details className={'advertising-admin '+s.panel} onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary><T>Gemeentegids · Bedrijven beheren</T></summary>
  <div className={s.content}>
   <p className={s.intro}><T>Alle bedrijfsvermeldingen uit de gemeentegids, inclusief bedrijven zonder advertentie. Kies een gemeente en rubriek om de gegevens te bekijken of aan te passen.</T></p>
   <div className={s.filters}>
    <label><T>Status</T><select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);setEditing(null);}}><option value="">{t('Alle vermeldingen')}</option><option value="pending">{t('Wacht op controle')}</option><option value="approved">{t('Goedgekeurd')}</option><option value="rejected">{t('Afgewezen')}</option></select></label>
    <label><T>Gemeente</T><select value={cityFilter} onChange={e=>changeFilter('city',e.target.value)}><option value="">{t('Alle gemeenten')}</option>{[...areaData.areas].sort((a,b)=>a.name.localeCompare(b.name,locale)).map(area=><option key={area.code_insee} value={area.code_insee}>{area.name}</option>)}</select></label>
    <label><T>Rubriek</T><select value={typeFilter} onChange={e=>changeFilter('type',e.target.value)}><option value="">{t('Alle rubrieken')}</option>{Object.entries(MUNICIPAL_BUSINESS_LABELS).sort((a,b)=>t(a[1]).localeCompare(t(b[1]),locale)).map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></label>
    <button type="button" onClick={()=>setRefresh(value=>value+1)} disabled={loading}><T>Vernieuwen</T></button>
   </div>
   <div className={s.resultBar} aria-live="polite"><strong>{loading?t('Laden…'):<><T>{total}</T> <T>{total===1?'bedrijf':'bedrijven'}</T></>}</strong><span><T>Beheeraanvragen en betalingen staan in hun eigen onderdelen.</T></span></div>
   {message&&<p role="status" className={s.message}><T>{message}</T></p>}
   {!loading&&<div className={s.list}>{items.map(item=><article key={item.id} className={s.card}>
    <div className={s.cardHeading}><div><p className={s.rubric}><T>{MUNICIPAL_BUSINESS_LABELS[item.municipal_type]||item.municipal_type}</T> · {item.city}</p><h3>{item.title}</h3></div><span className={item.promotion_status==='active'?s.active:s.badge}><T>{item.promotion_status==='active'?'Advertentie actief':'Gewone vermelding'}</T></span></div>
    <p className={s.address}>{item.address||t('Adres niet beschikbaar')}</p>
    {item.status==='pending'&&<div className={s.actions}><strong><T>Wacht op controle</T></strong><button type="button" disabled={busy} onClick={()=>void review(item.id,'approved')}><T>Goedkeuren</T></button><button type="button" disabled={busy} onClick={()=>void review(item.id,'rejected')}><T>Afwijzen</T></button></div>}
    {item.status==='rejected'&&<p><T>Afgewezen</T></p>}
    <div className={s.actions}><button type="button" onClick={()=>setEditing(item)}><T>Bedrijfsgegevens aanpassen</T></button><a href={'/gemeentegids/adverteren?'+new URLSearchParams({serviceId:item.municipal_key,city:item.city})}><T>Bekijk vermelding en advertentievoorbeeld →</T></a></div>
    {editing?.id===item.id&&<form className={s.editForm} onSubmit={save}><h4><T>Bedrijfsgegevens aanpassen</T></h4><div className={s.editGrid}>{([['title','Bedrijfsnaam'],['address','Adres'],['contact_phone','Telefoon'],['municipal_email','Zakelijk e-mailadres'],['municipal_hours','Openingstijden'],['website_url','Website'],['image_url','Foto-adres (eigen foto of toegestane bron)']] as const).map(([key,label])=><label key={key}><T>{label}</T><input required={key==='title'} type={key==='municipal_email'?'email':key==='website_url'||key==='image_url'?'url':'text'} value={editing[key]||''} onChange={e=>setEditing({...editing,[key]:e.target.value})}/></label>)}</div><label><T>Beschrijving</T><textarea value={editing.description||''} onChange={e=>setEditing({...editing,description:e.target.value})}/></label><div className={s.actions}><button type="submit" disabled={busy}><T>{busy?'Opslaan…':'Opslaan'}</T></button><button type="button" disabled={busy} onClick={()=>setEditing(null)}><T>Annuleren</T></button></div></form>}
   </article>)}</div>}
   {!loading&&!items.length&&!message&&<p className={s.message}><T>Geen bedrijven gevonden voor deze combinatie. Kies een andere gemeente of rubriek.</T></p>}
   <nav className={s.pagination} aria-label={t('Bladeren door bedrijven')}><button type="button" disabled={loading||page===1} onClick={()=>{setPage(value=>value-1);setEditing(null);}}><T>Vorige</T></button><span><T>Pagina </T>{page}<T> van </T>{Math.max(1,Math.ceil(total/25))}</span><button type="button" disabled={loading||page*25>=total} onClick={()=>{setPage(value=>value+1);setEditing(null);}}><T>Volgende</T></button></nav>
  </div>
 </details>;
}
