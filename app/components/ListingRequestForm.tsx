"use client";
import {T, A} from '../i18n/Language';

import {useState} from 'react';
export default function ListingRequestForm({eventId,title}:{eventId:string;title:string}) {
  const [kind,setKind]=useState<'claim'|'correction'|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[sent,setSent]=useState(false);
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();const form=e.currentTarget;setBusy(true);setMessage('');
    try {
      const fields=Object.fromEntries(new FormData(form));
      const response=await fetch('/api/listing-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,eventId,kind,consent:fields.consent==='on'})});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      setSent(true);setMessage(`Je ${kind==='claim'?'beheeraanvraag':'correctiemelding'} is ontvangen. Referentie: ${data.reference}. De beheerder controleert je verzoek. Er is nog niets gewijzigd en er zijn geen beheerrechten verleend. ${data.emailEnabled?(data.emailPreview?'Testmodus: de ontvangstbevestiging en beheerdersmelding gaan uitsluitend naar de eigen Strato-mailbox.':'Een ontvangstbevestiging is klaargezet voor verzending per e-mail.'):'Automatische e-mail is op deze testversie uitgeschakeld.'}`);
    }catch(error){setMessage(error instanceof Error?error.message:'Versturen mislukt.');}finally{setBusy(false);}
  }
  return <A><section className="listing-request" aria-label="Beheer of correctie aanvragen"><h3><T>{"Is dit jouw vermelding of zie je een fout?"}</T></h3><div className="management-link-actions"><button type="button" onClick={()=>{setKind('claim');setSent(false);setMessage('');}}><T>{"Deze vermelding beheren"}</T></button><button type="button" onClick={()=>{setKind('correction');setSent(false);setMessage('');}}><T>{"Correctie doorgeven"}</T></button></div>
    <T>{kind&&!sent&&<form className="owner-form" onSubmit={submit}><h4><T>{kind==='claim'?'Beheer aanvragen':'Correctie doorgeven'}</T><T>{" — "}</T><T>{title}</T></h4><p><T>{kind==='claim'?'We controleren eerst of je namens deze organisatie mag handelen. We gebruiken hiervoor contactgegevens van de officiële website of oorspronkelijke bron. Alleen je ingevulde e-mailadres is geen bewijs.':'Beschrijf wat er niet klopt en vermeld waar we de juiste informatie kunnen controleren. Je krijgt hiermee geen beheerrechten.'}</T></p>
      <label><T>{"Naam *"}</T><input name="name" required maxLength={150}/></label><label><T>{"E-mailadres *"}</T><input name="email" type="email" required maxLength={254}/></label><label><T>{"Organisatie "}</T><T>{kind==='claim'?'*':''}</T><input name="organization" required={kind==='claim'} maxLength={200}/></label><label><T>{"Telefoon"}</T><input name="phone" type="tel" maxLength={80}/></label><label><T>{kind==='claim'?'Jouw functie en toelichting *':'Wat moet worden gecorrigeerd? *'}</T><textarea name="message" required maxLength={4000} rows={4}/></label><label className="request-honeypot" aria-hidden="true"><T>{"Website"}</T><input name="website" tabIndex={-1} autoComplete="off"/></label><label><input type="checkbox" name="consent" required/><T>{" Ik geef toestemming om deze gegevens te gebruiken voor de behandeling van mijn verzoek."}</T></label><p><T>{"Je contactgegevens worden niet openbaar getoond. Lees onze "}</T><a href="/statistieken" target="_blank" rel="noreferrer"><T>{"privacy-informatie"}</T></a><T>{"."}</T></p><button disabled={busy} type="submit"><T>{busy?'Versturen…':'Verzoek versturen'}</T></button><button type="button" onClick={()=>setKind(null)}><T>{"Annuleren"}</T></button></form>}</T>
    <T>{message&&<p role="status"><T>{message}</T></p>}</T>
  </section></A>;
}
