
import {T, A} from '../i18n/Language';
import type {ReactNode} from 'react';
import g from '../gemeentegids/adverteren/preview.module.css';
import s from './new-event-experience.module.css';

export default function NewEventExperience({title,city,category,children}:{title:string;city:string;category:string;children:ReactNode}){
 const place=city.trim()||'Duras & omgeving';
 return <main className={`${g.root} ${s.root}`}>
  <header className={g.header}><a href="/" className={g.brand}><A><img src="/cote-de-duras-logo.webp" alt=""/></A><span><T>{"CÔTE DE DURAS"}</T><small><T>{"Evenementen · lokaal verbonden"}</T></small></span></a><a href="/#agenda"><T>{"← Terug naar de agenda"}</T></a></header>
  <section className={g.hero}><div><span className={g.pill}><T>{"Nieuwe vermelding · Evenementenkalender"}</T></span><p className={g.kicker}><T>{"Voor organisatoren en lokale ondernemers"}</T></p><h1><T>{"Jouw evenement."}</T><br/><T>{"Meer gezien in "}</T><T>{city.trim()||'Duras'}</T><T>{"."}</T></h1><p><T>{"Voeg je evenement of bedrijf toe aan de agenda. Begin met je vermelding en kies daarna hoeveel extra zichtbaarheid je wilt. Je ziet vooraf hoe jouw vermelding eruitziet."}</T></p><div className={g.businessChip}><span aria-hidden="true"><T>{"⌖"}</T></span><div><strong><T>{title.trim()||'Jouw nieuwe evenement of vermelding'}</T></strong><small><T>{category||'Jouw categorie'}</T><T>{" · "}</T><T>{place}</T></small></div></div></div>
   <aside className={g.heroAside}><span className={g.kicker}><T>{"Zo werkt het"}</T></span><ol><li><strong><T>{"Kies je zichtbaarheid"}</T></strong><span><T>{"Gratis vermelden of één, twee of drie advertentievormen combineren."}</T></span></li><li><strong><T>{"Bekijk je eigen voorbeeld"}</T></strong><span><T>{"Zie direct waar jouw vermelding opvalt, met je eigen naam en foto."}</T></span></li><li><strong><T>{"Eén overzicht, één betaling"}</T></strong><span><T>{"Alle gekozen vormen samen in één aanvraag."}</T></span></li></ol><p><T>{"Je betaalt veilig via Mollie na het opslaan van je vermelding en controle van de beschikbaarheid. Je vermelding verschijnt na goedkeuring; betaalde advertenties ook na betaalbevestiging, binnen de gekozen periode."}</T></p></aside>
  </section>
  <div className={s.content}><T>{children}</T></div>
  <section className={g.assurance}><div><strong><T>{"Eén vermelding, meerdere advertentiemogelijkheden"}</T></strong><p><T>{"Je evenement blijft tussen de gewone resultaten staan. Advertenties geven extra zichtbaarheid aan dezelfde vermelding."}</T></p></div><div><strong><T>{"Duidelijk vooraf"}</T></strong><p><T>{"Je kiest zelf je vormen en looptijd. Voor je betaalt zie je één overzicht met het totale bedrag."}</T></p></div></section>
  <footer className={g.footer}><a href="/#agenda"><T>{"Côte de Duras · Evenementenkalender"}</T></a><a href="/handleiding#toevoegen" target="_blank" rel="noreferrer"><T>{"Handleiding bij deze pagina ↗"}</T></a><a href="/mijn-vermelding"><T>{"Al een vermelding? Beheer je vermelding →"}</T></a></footer>
 </main>;
}
