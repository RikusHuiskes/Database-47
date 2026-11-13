'use client';
import {useCallback,useEffect,useState} from 'react';
import {T} from '../i18n/Language';
type Contract={id:string;method:string;status:string;amount_cents:number;paid_until:string|null;anchor_date:string};
export default function MonthlySubscriptions({access}:{access:{id:string;token:string}}){
 const [contracts,setContracts]=useState<Contract[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState<string|null>(null);
 const load=useCallback(async()=>{const response=await fetch('/api/managed-event?id='+access.id,{headers:{Authorization:'Bearer '+access.token},cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error);setContracts(data.contracts??[])},[access.id,access.token]);
 useEffect(()=>{let live=true;void load().catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[load]);
 async function act(id:string,action:'cancel'|'refresh'){
  setBusy(true);setError('');try{const response=await fetch('/api/managed-event/subscription',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({eventId:access.id,contractId:id,action})});const data=await response.json();if(!response.ok)throw Error(data.error);await load();setConfirm(null)}catch(e){setError(e instanceof Error?e.message:'Abonnement niet beschikbaar.')}finally{setBusy(false)}
 }
 return <section aria-labelledby="monthly-heading"><h2 id="monthly-heading"><T>Maandabonnementen</T></h2>
 {!contracts.length&&<p><T>Je hebt nog geen maandabonnementen.</T></p>}
 {contracts.map(c=><article key={c.id} className="owner-payment-card"><h3><T>{c.method==='sepa'?'Automatische SEPA-incasso':'Creditcard'}</T></h3><p>€ {(c.amount_cents/100).toFixed(2).replace('.',',')} <T>per maand</T> · <T>{({checkout:'Eerste betaling nog afronden',active:'Actief',past_due:'Betaling vraagt aandacht',cancelled:'Opgezegd'} as Record<string,string>)[c.status]}</T></p><p><T>Betaald tot:</T> {c.paid_until??'—'}</p>
 <button type="button" disabled={busy} onClick={()=>void act(c.id,'refresh')}><T>Betaalstatus controleren</T></button>
 {c.status!=='cancelled'&&(confirm===c.id?<div role="group" aria-label="Opzegging bevestigen"><p><T>Wil je dit maandabonnement opzeggen? Je advertentie blijft actief voor de betaalde periode. Een al gestarte betaling kan nog worden verwerkt.</T></p><button type="button" disabled={busy} onClick={()=>void act(c.id,'cancel')}><T>Ja, abonnement opzeggen</T></button><button type="button" disabled={busy} onClick={()=>setConfirm(null)}><T>Abonnement behouden</T></button></div>:<button type="button" disabled={busy} onClick={()=>setConfirm(c.id)}><T>Maandabonnement opzeggen</T></button>)}
 </article>)}
 {error&&<p role="alert"><T>{error}</T></p>}</section>;
}
