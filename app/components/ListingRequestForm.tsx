"use client";
import {useState} from 'react';
export default function ListingRequestForm({eventId,title}:{eventId:string;title:string}) {
  const [kind,setKind]=useState<'claim'|'correction'|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[sent,setSent]=useState(false);
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();const form=e.currentTarget;setBusy(true);setMessage('');
    try {
      const fields=Object.fromEntries(new FormData(form));
      const response=await fetch('/api/listing-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,eventId,kind,consent:fields.consent==='on'})});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      setSent(true);setMessage(`Je ${kind==='claim'?'beheeraanvraag':'correctiemelding'} is ontvangen. Referentie: ${data.reference}. De beheerder controleert je verzoek. Er is nog niets gewijzigd en er zijn geen beheerrechten verleend. ${data.emailEnabled?'Een ontvangstbevestiging is klaargezet voor verzending per e-mail.':'Automatische e-mail is op deze testversie uitgeschakeld.'}`);
    }catch(error){setMessage(error instanceof Error?error.message:'Versturen mislukt.');}finally{setBusy(false);}
  }
  return <section className="listing-request" aria-label="Beheer of correctie aanvragen"><h3>Is dit jouw vermelding of zie je een fout?</h3><div className="management-link-actions"><button type="button" onClick={()=>{setKind('claim');setSent(false);setMessage('');}}>Deze vermelding beheren</button><button type="button" onClick={()=>{setKind('correction');setSent(false);setMessage('');}}>Correctie doorgeven</button></div>
    {kind&&!sent&&<form className="owner-form" onSubmit={submit}><h4>{kind==='claim'?'Beheer aanvragen':'Correctie doorgeven'} — {title}</h4><p>{kind==='claim'?'We controleren eerst of je namens deze organisatie mag handelen. We gebruiken hiervoor contactgegevens van de officiële website of oorspronkelijke bron. Alleen je ingevulde e-mailadres is geen bewijs.':'Beschrijf wat er niet klopt en vermeld waar we de juiste informatie kunnen controleren. Je krijgt hiermee geen beheerrechten.'}</p>
      <label>Naam *<input name="name" required maxLength={150}/></label><label>E-mailadres *<input name="email" type="email" required maxLength={254}/></label><label>Organisatie {kind==='claim'?'*':''}<input name="organization" required={kind==='claim'} maxLength={200}/></label><label>Telefoon<input name="phone" type="tel" maxLength={80}/></label><label>{kind==='claim'?'Jouw functie en toelichting *':'Wat moet worden gecorrigeerd? *'}<textarea name="message" required maxLength={4000} rows={4}/></label><label className="request-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label><label><input type="checkbox" name="consent" required/> Ik geef toestemming om deze gegevens te gebruiken voor de behandeling van mijn verzoek.</label><p>Je contactgegevens worden niet openbaar getoond. Lees onze <a href="/statistieken" target="_blank" rel="noreferrer">privacy-informatie</a>.</p><button disabled={busy} type="submit">{busy?'Versturen…':'Verzoek versturen'}</button><button type="button" onClick={()=>setKind(null)}>Annuleren</button></form>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
