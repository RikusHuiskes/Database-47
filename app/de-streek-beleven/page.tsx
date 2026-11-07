import type {Metadata} from 'next';
import Image from 'next/image';
import {localizeMetadata} from '../i18n/server';
import {T, A} from '../i18n/Language';
import './region.css';

const sourceMetadata:Metadata={title:"De streek beleven | Côte de Duras",description:"Uitjes, lokale adressen en praktische hulp rond Duras. Ontdek de agenda, gemeentegids en mogelijkheden voor je eigen vermelding."};
export async function generateMetadata(){return localizeMetadata(sourceMetadata);}

export default function RegionIntroduction(){return <main className="region-introduction region-guide">
  <A><nav aria-label="Navigatie"><a href="/">Côte de Duras</a><a href="/#agenda"><T>{"Ontdek de agenda →"}</T></a><a href="/#gemeenten"><T>{"Bekijk de gemeentegids →"}</T></a></nav></A>
  <p className="section-kicker"><T>{"Nieuw in de streek. Dicht bij jou."}</T></p>
  <h1><T>{"Meer ontdekken. Meer beleven."}</T></h1>
  <p className="intro-lead"><T>{"Een markt op het dorpsplein, een concert tussen de wijngaarden of een goed adres voor vanavond. Côte de Duras is een nieuw lokaal initiatief dat je helpt de streek te beleven — tijdens je vakantie én het hele jaar door."}</T></p>
  <figure className="region-banner">
    <A><Image className="region-landscape" src="/streek-duras.jpg" fill sizes="(max-width: 680px) calc(100vw - 68px), (max-width: 964px) calc(100vw - 64px), 834px" preload alt="Zomers landschap met hooibalen op een geoogst veld, groene bomen en een blauwe lucht" /></A>
    <figcaption><strong><T>{"Duras en omgeving · binnen 50 kilometer"}</T></strong><span><T>{"Voor een dagje uit, een vakantie of het dagelijks leven."}</T></span></figcaption>
  </figure>
  <p className="region-welcome"><T>{"Gratis ontdekken, zonder account. Kies bovenaan Frans, Engels of Nederlands."}</T></p>
  <section id="agenda">
    <h2><T>{"Vind iets dat bij jouw dag past"}</T></h2>
    <p><T>{"Markten en brocantes, muziek, workshops, natuur, cultuur of gastronomie: in de agenda vind je evenementen én vaste adressen, zoals restaurants en accommodaties. Kies je plaats en categorie en bepaal je afstand: 5, 10, 25 of 50 kilometer. De zoekopdracht begint op 5 kilometer. Kies een datum of een begin- en einddatum om evenementen tijdens jouw bezoek te vinden. Wis de datums om ook vaste adressen te bekijken."}</T></p><p><T>{"Liever vlak bij waar je nu bent? Gebruik je locatie. Met Alleen gratis activiteiten vind je de als gratis vermelde activiteiten binnen je selectie. De resultaten verschijnen direct onder het zoekblok."}</T></p>
    <a className="region-action" href="/#agenda"><T>{"Ontdek de agenda →"}</T></a>
  </section>
  <section id="op-pad">
    <h2><T>{"Van een mooi plan naar een echt uitje"}</T></h2>
    <p><T>{"Open een vermelding voor de beschrijving, foto, locatie en beschikbare datum-, prijs- en contactgegevens. Via de website, reserveringslink of bronpagina lees je verder bij de aanbieder. Die links openen in een nieuw tabblad; met Terug naar de agenda sluit je de details en blijf je bij je zoekresultaten."}</T></p><p><T>{"Controleer vóór vertrek de actuele tijden en beschikbaarheid bij de aanbieder, vooral bij vaste adressen."}</T></p>

  </section>
  <section id="gemeentegids">
    <h2><T>{"Ook handig als je de weg nog niet kent"}</T></h2>
    <p><T>{"In Gemeente informatie kies je een plaats en het soort dienst dat je zoekt. Je vindt er onder meer winkels, supermarkten, toeristische informatie, gemeentehuizen, bibliotheken en kerken. Ook voor huisartsen, apotheken, tandartsen, ziekenhuizen, fysiotherapie en psychologische dienstverlening kun je de gids raadplegen."}</T></p><p><T>{"Onderweg helpen de rubrieken parkeren, parkeren voor mensen met een beperking, laadpunten, tankstations en openbaar vervoer. Bij een resultaat zie je de beschikbare adressen, contactgegevens, openingstijden en bron- of kaartlinks. Ligt een dienst in een andere plaats, dan wordt dat aangegeven."}</T></p>
    <a className="region-action" href="/#gemeenten"><T>{"Bekijk de gemeentegids →"}</T></a>
  </section>
  <section id="lokaal">
    <h2><T>{"Leer de mensen achter de streek kennen"}</T></h2>
    <p><T>{"Lokale ondernemers, verenigingen en organisatoren geven de streek haar karakter. De uitgelichte kaarten en carrousel laten betaalde vermeldingen uit de agenda en gemeentegids zien. Ze zijn herkenbaar als advertentie; met Ontdek lees je meer over de betreffende aanbieder."}</T></p>

  </section>
  <section id="meedoen">
    <h2><T>{"Een plek op de kaart voor jouw initiatief"}</T></h2>
    <p><T>{"Organiseer je iets of heb je een winkel, praktijk, restaurant of accommodatie? Via Vermelding toevoegen / beheren meld je gratis een evenement of een bedrijf in de gemeentegids aan, met je eigen foto en contactgegevens. Een bedrijf heeft geen evenementdatum nodig. Handmatige inzendingen worden vóór publicatie gecontroleerd."}</T></p><p><T>{"Staat je vermelding er al? Zoek haar op en vraag beheer aan of geef een correctie door. Met je persoonlijke beheerlink kun je gegevens en foto aanpassen, hulp bij toegang krijgen en je advertenties en betalingen beheren. Die link is privé."}</T></p><p><T>{"Extra zichtbaarheid nodig? Bekijk de voorbeelden en kies een vetomrande vermelding, een categorie- of homepageadvertentie. In de gemeentegids kun je ook rubriekpartner of gemeentepartner worden. Je ziet de looptijd en het totaal vooraf, betaalt via Mollie en vindt je betaalstatus terug bij je eigen vermelding. Een factuur wordt na opstelling per e-mail verzonden."}</T></p>
    <a className="region-action" href="/mijn-vermelding"><T>{"Vermelding toevoegen / beheren →"}</T></a>
  </section>
  <section id="samen">
    <h2><T>{"Een nieuwe gids die met de streek meegroeit"}</T></h2>
    <p><T>{"We brengen geselecteerde lokale bronnen en bijdragen van inwoners en ondernemers samen. De gids wordt aangevuld, maar niet ieder adres heeft al een foto, telefoonnummer of openingstijd. Bronvermeldingen helpen je verder; met een correctiemelding help je de informatie verbeteren."}</T></p><p><T>{"Een weekend hier of hier helemaal thuis: begin dichtbij en laat je verrassen."}</T></p>
    <a className="region-action" href="/handleiding"><T>{"Hulp nodig? Bekijk de handleiding →"}</T></a>
  </section>
  <div className="region-end"><a className="button button-dark" href="/#agenda"><T>{"Ontdek de agenda →"}</T></a><a href="mailto:info@cotededuras.com">info@cotededuras.com</a></div>
</main>}
