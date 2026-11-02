import type {ReactNode} from 'react';
import g from '../gemeentegids/adverteren/preview.module.css';
import s from './new-event-experience.module.css';

export default function NewEventExperience({title,city,category,children}:{title:string;city:string;category:string;children:ReactNode}){
 const place=city.trim()||'Duras & omgeving';
 return <main className={`${g.root} ${s.root}`}>
  <header className={g.header}><a href="/" className={g.brand}><img src="/cote-de-duras-logo.webp" alt=""/><span>CÔTE DE DURAS<small>Evenementen · lokaal verbonden</small></span></a><a href="/#agenda">← Terug naar de agenda</a></header>
  <section className={g.hero}><div><span className={g.pill}>Nieuwe vermelding · Evenementenkalender</span><p className={g.kicker}>Voor organisatoren en lokale ondernemers</p><h1>Jouw evenement.<br/>Meer gezien in {city.trim()||'Duras'}.</h1><p>Voeg je evenement of bedrijf toe aan de agenda. Begin met je vermelding en kies daarna hoeveel extra zichtbaarheid je wilt. Je ziet vooraf hoe jouw vermelding eruitziet.</p><div className={g.businessChip}><span aria-hidden="true">⌖</span><div><strong>{title.trim()||'Jouw nieuwe evenement of vermelding'}</strong><small>{category||'Jouw categorie'} · {place}</small></div></div></div>
   <aside className={g.heroAside}><p className={g.kicker}>Zo werkt het</p><ol><li><strong>Kies je zichtbaarheid</strong><span>Gratis vermelden of één, twee of drie advertentievormen combineren.</span></li><li><strong>Bekijk je eigen voorbeeld</strong><span>Zie direct waar jouw vermelding opvalt, met je eigen naam en foto.</span></li><li><strong>Eén overzicht, één betaling</strong><span>Alle gekozen vormen samen in één aanvraag.</span></li></ol><p>Je betaalt veilig via Mollie na het opslaan van je vermelding en controle van de beschikbaarheid. Je vermelding verschijnt na goedkeuring; betaalde advertenties ook na betaalbevestiging, binnen de gekozen periode.</p></aside>
  </section>
  <div className={s.content}>{children}</div>
  <section className={g.assurance}><div><strong>Eén vermelding, meerdere advertentiemogelijkheden</strong><p>Je evenement blijft tussen de gewone resultaten staan. Advertenties geven extra zichtbaarheid aan dezelfde vermelding.</p></div><div><strong>Duidelijk vooraf</strong><p>Je kiest zelf je vormen en looptijd. Voor je betaalt zie je één overzicht met het totale bedrag.</p></div></section>
  <footer className={g.footer}><a href="/#agenda">Côte de Duras · Evenementenkalender</a><a href="/mijn-vermelding">Al een vermelding? Beheer je vermelding →</a></footer>
 </main>;
}
