"use client";

import {T,useLanguage} from '../i18n/Language';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {advertisingOrderTypes,ADVERTISING_LABELS} from '../../lib/advertising';
import type {SupabaseClient} from '@supabase/supabase-js';

type Invoice={invoice_number:string;issued_at:string;state:'issued'|'cancelled';is_test_mode:boolean;net_cents:number;vat_cents:number;total_cents:number;advertising_invoice_mail_outbox:{state:string;accepted_at:string|null;last_error:string|null}[]};
type RequestRow={advertising_billing_cycles?:{cycle_index:number;state:string;advertising_contracts:{method:string;status:string;paid_until:string|null}}[];id:string;placement:string;details:Record<string,string>;starts_on:string;ends_on:string;months:number;amount_cents:number;payment_status:string;is_test_mode:boolean;events:{id:string;archived_at?:string|null;title:string;city?:string;municipal_key?:string;municipal_type?:string}|null;advertising_invoices:Invoice[]|Invoice|null};
type Summary={invoiceCount:number;invoicedTotalCents:number;unbilledRequestCount:number;testCount:number;mailPending:number;mailFailed:number};
type Settings={tax_mode:'standard'|'franchise_exempt';vat_rate:number;vat_number:string|null;tax_note:string;price_basis:'tax_inclusive'};
type AdminData={items:RequestRow[];total:number;page:number;summary:Summary;settings:Settings|null;invoiceSetupReady:boolean;invoiceSetupMissing:string[];mailConfigured:boolean;mailDeliveryEnabled:boolean;previewMode:boolean};
const zero:Summary={invoiceCount:0,invoicedTotalCents:0,unbilledRequestCount:0,testCount:0,mailPending:0,mailFailed:0};
const eur=(cents:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format((cents||0)/100);
const invoiceOf=(item:RequestRow)=>Array.isArray(item.advertising_invoices)?item.advertising_invoices[0]??null:item.advertising_invoices;
const invoiceMailOf=(invoice:Invoice|null)=>Array.isArray(invoice?.advertising_invoice_mail_outbox)?invoice.advertising_invoice_mail_outbox[0]??null:null;

export default function AdvertisingRequests({client,onListingArchived}:{client:SupabaseClient|null;onListingArchived?:()=>void}){
 const {t}=useLanguage();
 const dialogRef=useRef<HTMLDialogElement>(null);
 const [open,setOpen]=useState(false),[page,setPage]=useState(1),[data,setData]=useState<AdminData|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[version,setVersion]=useState(0),[editSettings,setEditSettings]=useState(false);
 const [draft,setDraft]=useState({tax_mode:'standard' as 'standard'|'franchise_exempt',vat_rate:'20',vat_number:'',tax_note:'',price_basis:false});
 const load=useCallback(async()=>{
  if(!client)return;
  try{
   const session=await client.auth.getSession();
   const response=await fetch('/api/admin/advertising?page='+page,{headers:{Authorization:'Bearer '+session.data.session?.access_token},cache:'no-store'});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Laden mislukt.');
   setData(result);setError('');
   if(result.settings){setDraft({tax_mode:result.settings.tax_mode,vat_rate:String(result.settings.vat_rate),vat_number:result.settings.vat_number??'',tax_note:result.settings.tax_note??'',price_basis:result.settings.price_basis==='tax_inclusive'});setEditSettings(false);}
   else {setDraft(current=>({...current,vat_number:'',tax_note:'',price_basis:false}));setEditSettings(true);}
  }catch(e){setError(e instanceof Error?e.message:'Laden mislukt.');}
 },[client,page]);
 useEffect(()=>{void load();},[load,version]);
 useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();if(!open&&dialog.open)dialog.close();},[open]);
 const action=async(body:Record<string,unknown>)=>{
  if(!client)return;setBusy(true);setMessage('');setError('');
  try{
   const session=await client.auth.getSession();const response=await fetch('/api/admin/advertising',{method:'POST',headers:{Authorization:'Bearer '+session.data.session?.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.error||'De actie is niet afgerond.');
   if(body.action==='archive-listing')onListingArchived?.();
   setMessage(result.message||'Opgeslagen.');setVersion(value=>value+1);
  }catch(e){setError(e instanceof Error?e.message:'De actie is niet afgerond.');}
  finally{setBusy(false);}
 };
 const saveSettings=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();void action({action:'save-settings',settings:{tax_mode:draft.tax_mode,vat_rate:draft.tax_mode==='franchise_exempt'?0:Number(draft.vat_rate),vat_number:draft.tax_mode==='franchise_exempt'?'':draft.vat_number.trim().toUpperCase(),tax_note:draft.tax_note.trim(),price_basis:draft.price_basis?'tax_inclusive':''}});};
 const summary=data?.summary??zero;
 return <section className="advertising-admin advertising-billing-admin">
  <div className="advertising-admin-summary">
   <div><strong><T>{"Facturen & advertentieaanvragen"}</T></strong><span><T>{"Gefactureerd: "}</T>{eur(summary.invoicedTotalCents)}<T>{" · "}</T>{summary.invoiceCount}<T>{" facturen"}</T></span></div>
   <button type="button" onClick={()=>{setMessage('');setError('');setOpen(true);}}><T>{"Open factuuroverzicht"}</T></button>
  </div>
  <dialog ref={dialogRef} className="advertising-invoice-dialog" aria-labelledby="advertising-invoice-title" onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
   <header className="advertising-invoice-dialog-header"><div><p className="eyebrow"><T>{"BEHEERDERSTOOL"}</T></p><h2 id="advertising-invoice-title"><T>{"Facturen en advertentieaanvragen"}</T></h2><p><T>{"Facturen beheer je los van de betaalmethode. Alleen wanneer jij per aanvraag op factuur opstellen klikt, krijgt die een opeenvolgend factuurnummer en wordt de factuur per e-mail aangeboden."}</T></p></div><button type="button" aria-label="Sluiten" onClick={()=>setOpen(false)}>×</button></header>
   <div className="advertising-invoice-dialog-content">
    {(error||message)&&<p className={error?'invoice-notice invoice-error':'invoice-notice'} role={error?'alert':'status'}>{error||message}</p>}
    <div className="invoice-summary-grid">
     <article><span><T>{"Totaal gefactureerd"}</T></span><strong>{eur(summary.invoicedTotalCents)}</strong><small>{summary.invoiceCount}<T>{" uitgegeven facturen"}</T></small></article>
    <article><span><T>{"Nog zonder factuur"}</T></span><strong>{summary.unbilledRequestCount}</strong><small><T>{"Eenmalige facturen handmatig; maandfacturen automatisch na betaling"}</T></small></article>
     <article><span><T>{"Testaanvragen"}</T></span><strong>{summary.testCount}</strong><small><T>{"Uitgesloten van de factuurteller"}</T></small></article>
     <article><span><T>{"E-mailwachtrij"}</T></span><strong>{summary.mailPending}</strong><small>{summary.mailFailed}<T>{" mislukt"}</T></small></article>
    </div>
    <section className="invoice-settings-panel">
     <div className="invoice-settings-heading"><div><h3><T>{"Factuurgegevens Côte de Duras"}</T></h3><p><T>{"Facturen staan los van de betaalmethode. Je kiest per aanvraag wanneer je een factuur opstelt en verstuurt."}</T></p></div>{data?.settings&&!editSettings&&<button type="button" onClick={()=>setEditSettings(true)}><T>{"Factuurinstellingen aanpassen"}</T></button>}</div>
     {editSettings||!data?.invoiceSetupReady?<form className="invoice-settings-form" onSubmit={saveSettings}>
      <label><T>{"Btw-regime"}</T><select value={draft.tax_mode} onChange={event=>setDraft(current=>({...current,tax_mode:event.target.value as Settings['tax_mode']}))}><option value="standard"><T>{"Btw-plichtig"}</T></option><option value="franchise_exempt"><T>{"Vrijgesteld van btw"}</T></option></select></label>
      {draft.tax_mode==='standard'&&<><label><T>{"Btw-tarief (%)"}</T><input type="number" min="0.01" max="25" step="0.01" required value={draft.vat_rate} onChange={event=>setDraft(current=>({...current,vat_rate:event.target.value}))}/></label><label className="invoice-settings-wide"><T>{"Frans intracommunautair btw-nummer (FR + 11 cijfers)"}</T><input autoComplete="off" inputMode="text" placeholder="FR…" value={draft.vat_number} onChange={event=>setDraft(current=>({...current,vat_number:event.target.value.toUpperCase()}))} required pattern="FR[0-9]{11}" title="Gebruik FR gevolgd door 11 cijfers."/><small><T>{"Het nummer wordt gecontroleerd voordat het wordt opgeslagen."}</T></small></label></>}
      <label className="invoice-settings-wide"><T>{draft.tax_mode==='standard'?"Btw-vermelding op de factuur":"Wettelijke vrijstellingsvermelding"}</T><input value={draft.tax_note} onChange={event=>setDraft(current=>({...current,tax_note:event.target.value}))} required placeholder={draft.tax_mode==='standard'?"Bijvoorbeeld: TVA 20 %":"Vul de juiste wettelijke vermelding in"}/></label>
      <label className="invoice-settings-confirm invoice-settings-wide"><input type="checkbox" checked={draft.price_basis} onChange={event=>setDraft(current=>({...current,price_basis:event.target.checked}))}/><span><T>{"Ik bevestig dat de in de site getoonde advertentieprijzen inclusief btw zijn; deze bedragen vormen het factuurtotaal."}</T></span></label>
      <div className="invoice-settings-actions invoice-settings-wide"><button type="submit" disabled={busy||!draft.price_basis}><T>{"Factuurinstellingen opslaan"}</T></button>{data?.settings&&<button type="button" disabled={busy} onClick={()=>setEditSettings(false)}><T>{"Annuleren"}</T></button>}</div>
     <p className="invoice-settings-wide invoice-settings-hint"><T>{"De btw-vermelding en het tarief moeten overeenkomen met jouw fiscale situatie. Factuurnummers worden pas uitgegeven als je een factuur handmatig opstelt."}</T></p>
     </form>:<div className="invoice-settings-ready"><p><strong><T>{"Factuurinstellingen zijn opgeslagen."}</T></strong> <T>{"Je kiest per advertentieaanvraag of en wanneer je de factuur opstelt."}</T></p></div>}
     {data?.previewMode&&<p className="invoice-settings-hint"><T>{"Previewmodus: factuurmails gaan uitsluitend naar het eigen ingestelde mailboxadres."}</T></p>}
     {!data?.mailConfigured&&<p className="invoice-settings-hint"><T>{"De Strato-mailinstellingen zijn nog niet compleet. Facturen kunnen worden klaargezet, maar e-mail wordt pas verzonden zodra de mailkoppeling actief is."}</T></p>}
     {data?.mailConfigured&&!data.mailDeliveryEnabled&&<p className="invoice-settings-hint"><T>{"Automatische e-mailverzending staat uit. Bekijk Strato-mailverbinding om dit veilig in te schakelen."}</T></p>}
    </section>

    <div className="invoice-list-heading"><div><h3><T>{"Factuurlijst en advertentieaanvragen"}</T></h3><p><T>{"Mollie-betaalstatus en facturen worden apart beheerd. Testaanvragen kun je verwijderen; uitgegeven facturen blijven bewaard."}</T></p></div><div><button type="button" disabled={busy} onClick={()=>void action({action:'process'})}><T>{"E-mails opnieuw proberen"}</T></button><button type="button" disabled={busy} onClick={()=>setVersion(value=>value+1)}><T>{"Vernieuwen"}</T></button></div></div>
    {data?.items.map(item=>{
     const invoice=invoiceOf(item),mail=invoiceMailOf(invoice),types=advertisingOrderTypes(item).map(type=>item.events?.municipal_key&&type==='homepage'?'Gemeentepartner':item.events?.municipal_key&&type==='category'?'Rubriekpartner':ADVERTISING_LABELS[type]).join(' + ');
     const status=invoice?.invoice_number?`${invoice.is_test_mode?'TEST · ':''}${invoice.invoice_number} · ${invoice.state==='cancelled'?'geannuleerd':'uitgegeven'}`:item.is_test_mode?'Test — geen factuur':'Nog geen factuur';
     return <article className={'advertising-invoice-row'+(item.is_test_mode||invoice?.is_test_mode?' is-test':'')} key={item.id}>
      <div className="advertising-invoice-row-top"><div><p className="eyebrow">{item.is_test_mode?<T>{"TEST"}</T>:item.events?.municipal_key?<T>{"GEMEENTEGIDS"}</T>:<T>{"EVENEMENTENKALENDER"}</T>}</p><h4>{item.events?.title??'Vermelding'}{types?' — '+types:''}</h4></div><strong>{eur(invoice?.total_cents??item.amount_cents)}</strong></div>
      <p><T>{item.starts_on}</T><T>{" t/m "}</T><T>{item.ends_on}</T><T>{" · Betaalstatus (Mollie): "}</T><T>{item.payment_status}</T><T>{" · Factuur: "}</T><T>{status}</T></p>
      {item.advertising_billing_cycles?.map(cycle=><p key={cycle.cycle_index}><T>Maandabonnement</T> · <T>{cycle.advertising_contracts.method==='creditcard'?'Creditcard':'Automatische SEPA-incasso'}</T> · <T>{({checkout:'Eerste betaling nog afronden',active:'Actief',past_due:'Betaling vraagt aandacht',cancelled:'Opgezegd'} as Record<string,string>)[cycle.advertising_contracts.status]}</T> · <T>Betaald tot:</T> {cycle.advertising_contracts.paid_until??'—'}</p>)}
      <p>{item.details?.name}<T>{" · "}</T><T preserve>{item.details?.company}</T><T>{" · "}</T><T preserve>{item.details?.email}</T><T>{" · "}</T><T preserve>{item.details?.phone}</T></p>
      <p><T preserve>{item.details?.address}</T><T>{", "}</T><T preserve>{item.details?.postcode}</T><T>{" "}</T><T>{item.details?.city}</T><T>{item.details?.vatNumber?' · TVA '+item.details.vatNumber:''}</T></p>
      {invoice&&<p><T>{"Netto "}</T>{eur(invoice.net_cents)}<T>{" · btw "}</T>{eur(invoice.vat_cents)}<T>{" · e-mail: "}</T><T>{mail?.state==='accepted'?'door mailserver geaccepteerd':mail?.state==='failed'?'verzending mislukt':mail?.state==='sending'?'wordt verzonden':'wacht op verzending'}</T><T>{mail?.last_error?' · '+mail.last_error:''}</T></p>}
      {!invoice&&!item.is_test_mode&&(!item.advertising_billing_cycles?.length||item.payment_status==='paid')&&<button type="button" disabled={busy||!data?.invoiceSetupReady} onClick={()=>void action({action:'issue-invoice',requestId:item.id})}><T>{"Factuur opstellen en versturen"}</T></button>}
      {item.events?.archived_at&&<p><T>{"Vermelding verwijderd — factuurhistorie bewaard."}</T></p>}
      {item.events&&!item.events.archived_at&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm(t('Deze vermelding uit de actieve lijst verwijderen? Bestaande facturen blijven bewaard.')))void action({action:'archive-listing',eventId:item.events!.id});}}><T>{"Vermelding uit actieve lijst verwijderen"}</T></button>}
      {item.is_test_mode&&!item.advertising_billing_cycles?.length&&<button type="button" disabled={busy} onClick={()=>void action({action:'delete-test',requestId:item.id})}><T>{"Testaanvraag uit lijst verwijderen"}</T></button>}
     </article>;
    })}
    {data?.items.length===0&&<p><T>{"Geen advertentieaanvragen."}</T></p>}
    <div className="analytics-controls"><button type="button" disabled={page===1} onClick={()=>setPage(value=>value-1)}><T>{"Vorige"}</T></button><span><T>{"Pagina "}</T>{page}<T>{" van "}</T>{Math.max(1,Math.ceil((data?.total??0)/10))}<T>{" · "}</T>{data?.total??0}<T>{" aanvragen"}</T></span><button type="button" disabled={page*10>=(data?.total??0)} onClick={()=>setPage(value=>value+1)}><T>{"Volgende"}</T></button></div>
   </div>
  </dialog>
 </section>;
}
