import type {Metadata} from 'next';

export const metadata:Metadata={title:'Handleiding voor bezoekers | Côte de Duras',description:'Stap voor stap zoeken in de agenda, de gemeentegids gebruiken en een evenement of vermelding toevoegen, beheren of corrigeren.'};
const chapters=[['zoeken','Een activiteit of adres zoeken'],['gemeentegids','De gemeentegids gebruiken'],['toevoegen','Een evenement of vermelding toevoegen'],['wijzigen','Je eigen vermelding wijzigen'],['beheer-aanvragen','Beheer aanvragen zonder beheerlink'],['correctie','Een fout doorgeven'],['advertenties','Uitgelichte vermeldingen en advertenties'],['hulp','Andere onderdelen en hulp']];

export default function VisitorGuide(){return <main className="region-introduction visitor-manual" id="handleiding-top">
  <nav aria-label="Navigatie"><a href="/">← Côte de Duras</a><a href="/#agenda">Naar de agenda →</a></nav>
  <p className="section-kicker">Hulp bij het gebruik van de website</p><h1>Handleiding voor bezoekers van Côte de Duras</h1>
  <p className="intro-lead">Met Côte de Duras vind je evenementen, activiteiten, accommodaties en praktische voorzieningen in de streek rond Duras. Je kunt de website doorzoeken zonder een account aan te maken.</p>
  <nav className="manual-contents" aria-label="Inhoud van de handleiding"><h2>Waar wil je hulp bij?</h2><ol>{chapters.map(([id,title])=><li key={id}><a href={'#'+id}>{title}</a></li>)}</ol></nav>

  <section id="zoeken"><h2>1. Een activiteit of adres zoeken</h2><ol>
    <li>Klik bovenaan in het menu op <strong>Agenda</strong>. Je komt bij het zoekscherm <strong>Vind jouw volgende uitje</strong>.</li>
    <li>Kies bij <strong>Plaats</strong> de gemeente van waaruit je wilt zoeken.</li>
    <li>Kies bij <strong>Zoek binnen</strong> een afstand van <strong>10, 25 of 50 kilometer</strong>.</li>
    <li>Wil je rond je huidige locatie zoeken? Klik dan op <strong>Gebruik mijn locatie</strong> en geef je browser toestemming. Je kunt ook gewoon een gemeente blijven gebruiken.</li>
    <li>Vul eventueel bij <strong>Zoek op activiteit</strong> een zoekwoord in, bijvoorbeeld ‘markt’ of ‘concert’.</li>
    <li>Kies bij <strong>Soort activiteit</strong> een categorie, bijvoorbeeld <strong>Restaurants &amp; Gastronomie</strong>, <strong>Wijnhuizen</strong> of <strong>Hotels &amp; Chambres d’hôtes &amp; Gîtes</strong>.</li>
    <li>Vink <strong>Alleen gratis activiteiten</strong> aan als je uitsluitend activiteiten zonder toegangsprijs wilt zien.</li>
  </ol><p>De resultaten worden automatisch aangepast. Onder de zoekvelden zie je hoeveel activiteiten bij je keuzes passen.</p>
  <p className="manual-tip"><strong>Geen geschikt resultaat?</strong> Verwijder je zoekwoord, kies <strong>Alle soorten</strong>, schakel het filter voor gratis activiteiten uit of vergroot de afstand.</p>
  <p>Scroll door de resultaten. Met <strong>Toon meer activiteiten</strong> laad je extra vermeldingen.</p>
  <h3>De details bekijken</h3><ol>
    <li>Klik op de titel, de foto of <strong>Bekijk evenementdetails</strong>.</li>
    <li>Lees de beschrijving, datum, locatie en eventuele prijs.</li>
    <li>Gebruik, indien aanwezig: <strong>Reserveren</strong> om naar de reserveringspagina te gaan; <strong>Website organisator</strong> voor de website van de aanbieder; <strong>Oorspronkelijke informatie</strong> om de bron te bekijken.</li>
    <li>Klik op <strong>Terug naar de agenda</strong> of op het <strong>kruisje rechtsboven</strong> om het detailvenster te sluiten.</li>
  </ol><p>Externe websites openen in een nieuw tabblad. Reserveren gebeurt bij de aanbieder. Controleer daar de actuele beschikbaarheid, openingstijden en prijzen.</p><p>Bij een vaste vermelding, zoals een accommodatie of bedrijf, staat niet altijd een evenementdatum.</p><a className="manual-action" href="/#agenda">Zoek in de agenda →</a></section>

  <section id="gemeentegids"><h2>2. De gemeentegids gebruiken</h2><ol>
    <li>Klik in het menu op <strong>Gemeente informatie</strong>.</li>
    <li>Kies bij <strong>Gemeente of dorp</strong> de plaats waarover je informatie zoekt.</li>
    <li>Kies bij <strong>Welke informatie zoek je?</strong> een voorziening, bijvoorbeeld <strong>Gemeentehuis &amp; burgemeester</strong>, <strong>Huisarts / medisch centrum</strong>, <strong>Dichtstbijzijnde ziekenhuis</strong>, <strong>Bibliotheek</strong>, <strong>Apotheek</strong>, <strong>Supermarkten</strong>, <strong>Tankstations</strong> of <strong>Laadpalen voor elektrische voertuigen</strong>.</li>
    <li>Wil je het complete overzicht? Kies dan <strong>Alle categorieën — complete gemeentegids</strong>.</li>
    <li>Klik op <strong>Toon informatie</strong>.</li>
    <li>Wacht tot het ophalen klaar is en bekijk de resultaten onder de zoekvelden.</li>
    <li>Gebruik de getoonde website-, telefoon- of kaartlinks voor meer informatie.</li>
  </ol><p>Let op de vermelde plaats en afstand. Sommige voorzieningen liggen in een omliggende gemeente.</p><p>Een ontbrekend resultaat betekent niet automatisch dat de voorziening niet bestaat. Gebruik dan de aangeboden aanvullende zoeklinks of neem contact op met het gemeentehuis.</p><p>Wil je een andere gemeente of voorziening bekijken? Pas je keuze aan en klik opnieuw op <strong>Toon informatie</strong>.</p><a className="manual-action" href="/#gemeenten">Open de gemeentegids →</a></section>

  <section id="toevoegen"><h2>3. Zelf een evenement of vermelding toevoegen</h2><p>Controleer eerst via de agenda of je evenement of bedrijf al vermeld staat. Staat het er al? Volg dan <a href="#wijzigen">hoofdstuk 4</a> of <a href="#beheer-aanvragen">hoofdstuk 5</a> om een wijziging aan te vragen.</p><p>Voor een nieuwe vermelding:</p><ol>
    <li>Klik in het menu op <strong>Nieuw evenement/vermelding</strong>.</li>
    <li>Voeg eventueel een foto toe via <strong>Foto van het evenement uploaden</strong>. Je ziet een voorbeeld van de gekozen foto.</li>
    <li>Kies bij <strong>Extra bereik voor je evenement</strong> de gewenste plaatsing. Voor een gewone vermelding kies je <strong>Gratis vermelding (standaard)</strong>.</li>
    <li>Kies bij <strong>Wat wil je invoeren?</strong> voor <strong>Evenement met datum</strong> voor een activiteit op een bepaalde datum, of <strong>Vaste vermelding / bedrijf / accommodatie</strong> voor bijvoorbeeld een bedrijf, restaurant of verblijf.</li>
    <li>Vul de <strong>Titel</strong>, <strong>Categorie</strong>, <strong>Korte beschrijving</strong> en <strong>Uitgebreide beschrijving</strong> in.</li>
    <li>Vul bij een evenement de <strong>Begindatum en -tijd</strong> en eventueel de <strong>Einddatum en -tijd</strong> in.</li>
    <li>Vul de locatie, het adres, de postcode en de plaats in. Staat je plaats niet in de lijst? Kies <strong>Andere plaats…</strong>.</li>
    <li>Geef aan of het evenement gratis is. Vul anders de toepasselijke prijsgegevens in.</li>
    <li>Vul <strong>Website</strong>, <strong>Reserveringslink</strong> en <strong>Informatiebron</strong> in. Heb je geen aparte reserverings- of bronpagina? Gebruik dan dezelfde website.</li>
    <li>Controleer de velden met een <strong>sterretje</strong> en klik op <strong>Evenement/vermelding opslaan</strong>.</li>
  </ol><p>Je inzending komt eerst bij de beheerder ter controle en verschijnt niet meteen openbaar.</p>
  <h3>Bewaar je persoonlijke beheerlink</h3><p>Na het insturen verschijnt <strong>Je vermelding is ingestuurd — bewaar je beheerlink</strong>.</p><ul>
    <li>Klik op <strong>Beheerlink kopiëren</strong> om de link zelf te bewaren.</li>
    <li>Of klik op <strong>Beheerlink bewaren als bestand</strong>.</li>
    <li>Met <strong>Mijn vermelding beheren</strong> open je het wijzigingsformulier.</li>
  </ul><p className="manual-tip">Bewaar de link als een wachtwoord. Iedereen die de volledige link heeft, kan jouw vermelding beheren. Vertrouw niet uitsluitend op het bewaren van de link in je browser.</p></section>

  <section id="wijzigen"><h2>4. Een eigen vermelding of evenement wijzigen</h2><h3>Je hebt al een persoonlijke beheerlink</h3><ol>
    <li>Open je bewaarde beheerlink rechtstreeks, of klik in het menu op <strong>Mijn vermelding</strong>.</li>
    <li>Plak bij <strong>Persoonlijke beheerlink</strong> de volledige link.</li>
    <li>Klik op <strong>Open mijn vermelding</strong>.</li>
    <li>Pas de gewenste gegevens aan, bijvoorbeeld de titel, beschrijving, datum, prijs, contactgegevens of website.</li>
    <li>Klik onderaan op <strong>Wijzigingen opslaan</strong>.</li>
    <li>Wacht op de bevestiging direct onder de knop.</li>
    <li>Open de vermelding opnieuw in de agenda. Vernieuw de pagina als je nog de vorige gegevens ziet.</li>
  </ol><p>Als de pagina <strong>Op dit apparaat bewaarde vermeldingen</strong> toont, kun je daar ook je vermelding kiezen. Deze lijst is alleen beschikbaar in de browser waarin de links zijn bewaard.</p>
  <h3>Een foto toevoegen of vervangen</h3><ol>
    <li>Ga in het wijzigingsformulier naar <strong>Foto vervangen</strong>.</li>
    <li>Klik op <strong>Bestand kiezen</strong>.</li>
    <li>Selecteer een <strong>JPG-, PNG- of WebP-foto van maximaal 5 MB</strong>.</li>
    <li>Controleer het fotovoorbeeld.</li>
    <li>Verkeerde foto gekozen? Klik op <strong>Gekozen foto annuleren</strong> of kies een ander bestand.</li>
    <li>Klik op <strong>Wijzigingen opslaan</strong> en wacht op de bevestiging.</li>
  </ol><p className="manual-tip">Een foto kiezen is nog niet hetzelfde als opslaan.</p>
  <h3>Je beheerlink kwijt?</h3><ol>
    <li>Klik in het menu op <strong>Mijn vermelding</strong>.</li>
    <li>Open <strong>Beheerlink kwijt of nooit ontvangen?</strong></li>
    <li>Controleer eerst of de link nog op je apparaat of in je bewaarde bestand staat.</li>
    <li>Vul anders de titel, plaats en het oorspronkelijke contact-e-mailadres in.</li>
    <li>Klik op <strong>E-mail met herstelverzoek opstellen</strong>.</li>
    <li>Je e-mailprogramma opent een concept. Verstuur dat bericht daar zelf.</li>
  </ol><p>De beheerder controleert je bevoegdheid voordat opnieuw toegang wordt verstrekt.</p><a className="manual-action" href="/mijn-vermelding">Open Mijn vermelding →</a></section>

  <section id="beheer-aanvragen"><h2>5. Een bestaande vermelding beheren zonder beheerlink</h2><p>Sommige vermeldingen zijn uit externe bronnen overgenomen. Je krijgt niet automatisch toegang omdat je naam of bedrijf erbij staat.</p><ol>
    <li>Zoek de vermelding via <strong>Agenda</strong>.</li>
    <li>Klik op <strong>Bekijk evenementdetails</strong>.</li>
    <li>Ga naar <strong>Is dit jouw vermelding of zie je een fout?</strong></li>
    <li>Klik op <strong>Deze vermelding beheren</strong>.</li>
    <li>Vul je naam, e-mailadres, organisatie, eventueel telefoonnummer en <strong>Jouw functie en toelichting</strong> in.</li>
    <li>Vink de toestemming voor het behandelen van je verzoek aan.</li>
    <li>Klik op <strong>Verzoek versturen</strong>.</li>
    <li>Bewaar de referentie die in de ontvangstmelding verschijnt.</li>
  </ol><p>Je aanvraag geeft nog geen wijzigingsrechten. De beheerder controleert eerst of je namens de organisatie mag handelen, via onafhankelijk gevonden officiële contactgegevens. Na goedkeuring ontvang je de instructies voor toegang.</p></section>

  <section id="correctie"><h2>6. Een fout doorgeven zonder beheerrechten</h2><p>Wil je alleen verkeerde informatie melden?</p><ol>
    <li>Open de vermelding via <strong>Bekijk evenementdetails</strong>.</li>
    <li>Klik op <strong>Correctie doorgeven</strong>.</li>
    <li>Vul je naam en e-mailadres in.</li>
    <li>Beschrijf bij <strong>Wat moet worden gecorrigeerd?</strong> wat onjuist is, wat de juiste informatie is en waar dit gecontroleerd kan worden.</li>
    <li>Vink de toestemming aan en klik op <strong>Verzoek versturen</strong>.</li>
    <li>Bewaar de referentie uit de ontvangstmelding.</li>
  </ol><p>De beheerder beoordeelt je melding. Een correctiemelding past de vermelding niet direct aan en geeft geen beheerrechten.</p></section>

  <section id="advertenties"><h2>7. Uitgelichte vermeldingen en advertenties</h2><p>Op brede schermen staan de uitgelichte advertenties rechts naast de agenda. Tijdens het scrollen blijft de zijbalk staan en wisselen de advertenties automatisch.</p><p>Kies je een categorie, dan zie je de beschikbare categorieadvertenties. Op kleinere schermen staan de advertenties tussen de paginaonderdelen.</p><p>Klik op een advertentie om de details te openen.</p><p>Wil je zelf adverteren? Kies bij het toevoegen van een vermelding een betaalde optie onder <strong>Extra bereik voor je evenement</strong>. Vul de periode en factuurgegevens in en sla de vermelding op. Open daarna <strong>Mijn vermelding beheren</strong> voor de beschikbare betaalstappen. Een advertentie verschijnt na goedkeuring en betaalbevestiging, binnen de afgesproken periode.</p></section>

  <section id="hulp"><h2>8. Andere onderdelen en hulp</h2><ul>
    <li><strong>De streek beleven:</strong> uitleg over de website en de regio. Met <strong>Ontdek de agenda</strong> ga je naar het zoekscherm.</li>
    <li><strong>Ontdekken:</strong> snel naar de agenda of gemeentegids.</li>
    <li><strong>Gezondheid:</strong> het onderdeel over buitenactiviteiten. Voor medische adressen gebruik je <strong>Gemeente informatie</strong>.</li>
    <li><strong>Contactgegevens:</strong> onderaan de website vind je hoe je Côte de Duras kunt bereiken.</li>
    <li><strong>Statistiekvoorkeuren:</strong> onderaan de website kun je je keuze voor het meten van websitegebruik aanpassen.</li>
  </ul><p>Voor hulp kun je mailen naar <a href="mailto:info@cotededuras.com">info@cotededuras.com</a>. Vermeld de titel van de betreffende vermelding en eventueel je aanvraagreferentie. Stuur je persoonlijke beheerlink niet mee in een openbaar bericht.</p></section>
  <nav className="manual-bottom-nav" aria-label="Verder navigeren"><a href="#handleiding-top">↑ Terug naar de inhoud</a><a href="/#agenda">Naar de agenda →</a></nav>
</main>}
