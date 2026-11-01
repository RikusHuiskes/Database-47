"use client";
import {useState} from 'react';
import ListingRequestForm from './ListingRequestForm';
export default function MunicipalManagementAccess({serviceId,city,title}:{serviceId:string;city:string;title:string}){
 const [id,setId]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function prepare(){setBusy(true);setError('');try{const r=await fetch('/api/municipal-listing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serviceId,city})});const data=await r.json();if(!r.ok)throw Error(data.error);setId(data.eventId);}catch(e){setError(e instanceof Error?e.message:'Voorbereiden mislukt.');}finally{setBusy(false);}}
 return <div><p>Je bestaande bedrijfsvermelding blijft behouden. Na controle door de beheerder ontvang je je persoonlijke beheerlink per e-mail.</p>{!id?<button type="button" className="button button-dark" disabled={busy} onClick={()=>void prepare()}>{busy?'Vermelding ophalen…':'Beheer of correctie aanvragen'}</button>:<ListingRequestForm eventId={id} title={title} municipal/>}{error&&<p role="alert">{error}</p>}</div>;
}
