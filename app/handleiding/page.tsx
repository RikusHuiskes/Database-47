import type {Metadata} from 'next';

export const metadata:Metadata={title:'Handleiding | Côte de Duras',description:'Uitleg over de nieuwe invoerpagina, visuele advertentievoorbeelden, gecombineerde betaling, agenda, gemeentegids en beheer.'};
const chapters=[['zoeken','Een activiteit of adres zoeken'],['gemeentegids','De gemeentegids gebruiken'],['toevoegen','Een evenement of vermelding toevoegen'],['wijzigen','Je eigen vermelding wijzigen'],['beheer-aanvragen','Beheer aanvragen zonder beheerlink'],['correctie','Een fout doorgeven'],['advertenties','Adverteren met een evenement of bestaande vermelding'],['adverteren-gemeentegids','Adverteren in de gemeentegids'],['hulp','Andere onderdelen en hulp'],['voor-beheerders','Voor beheerders: aanvragen, bedrijven en rapportages']];

export default function VisitorGuide(){return <main className="region-introduction visitor-manual" id="handleiding-top">
  <nav aria-label="Navigatie"><a href="/">← Côte de Duras</a><a href="/#agenda">Naar de agenda →</a></nav>
  <p className="section-kicker">Hulp bij het gebruik van de website</p><h1>Handleiding van Côte de Duras</h1>
  <p className="intro-lead">Met Côte de Duras vind je evenementen, activiteiten, accommodaties en praktische voorzieningen in de streek rond Duras. Je kunt de website doorzoeken zonder een account aan te maken.</p>
  <p className="manual-tip"><strong>Bijgewerkt op 2 november 2026.</strong> Deze handleiding beschrijft de nieuwe invoerpagina met dezelfde rustige opbouw als de gemeentegids: een introductie met je vermelding, advertentiekeuzes, meebewegende voorbeelden en één gezamenlijk betaaloverzicht. De uitleg voor beheerders staat apart onderaan.</p>
  <nav className="manual-contents" aria-label="Inhoud van de handleiding"><h2>Waar wil je hulp bij?</h2><ol>{chapters.map(([id,title])=><li key={id}><a href={'#'+id}>{title}</a></li>)}</ol></nav>

  <section id="zoeken"><h2>1. Een activiteit of adres zoeken</h2><ol>
    <li>Klik bovenaan in het menu op <strong>Agenda</strong>. Je komt bij het zoekscherm <strong>Vind jouw volgende uitje</strong>.</li>
    <li>Kies bij <strong>Plaats</strong> de gemeente van waaruit je wilt zoeken.</li>
    <li>Kies bij <strong>Zoek binnen</strong> een afstand van <strong>10, 25 of 50 kilometer</strong>.</li>
    <li>Wil je rond je huidige locatie zoeken? Klik dan op <strong>Gebruik mijn locatie</strong> en geef je browser toestemming. Je kunt ook gewoon een gemeente blijven gebruiken. Ligt je browserlocatie buiten het gebied van de streekgids of worden daar geen vermeldingen gevonden? Dan zoekt de website rond de gekozen plaats en verschijnt daarover een melding. Je afstand en categorie blijven behouden.</li>
    <li>Vul eventueel bij <strong>Zoek op activiteit</strong> een zoekwoord in, bijvoorbeeld ‘markt’ of ‘concert’.</li>
    <li>Bij <strong>Soort activiteit</strong> staat <strong>Alle soorten</strong> bovenaan; de overige categorieën staan alfabetisch. Kies een categorie, bijvoorbeeld <strong>Restaurants &amp; Gastronomie</strong>, <strong>Wijnhuizen</strong> of <strong>Hotels &amp; Chambres d’hôtes &amp; Gîtes</strong>.</li>
    <li>Vink <strong>Alleen gratis activiteiten</strong> aan als je uitsluitend activiteiten zonder toegangsprijs wilt zien.</li>
  </ol><p>De resultaten worden automatisch aangepast. Onder de zoekvelden zie je hoeveel activiteiten bij je keuzes passen.</p>
  <p className="manual-tip"><strong>Geen geschikt resultaat?</strong> Verwijder je zoekwoord, kies <strong>Alle soorten</strong>, schakel het filter voor gratis activiteiten uit of vergroot de afstand.</p>
  <p>Scroll door de resultaten. Met <strong>Toon meer activiteiten</strong> laad je extra vermeldingen. Actieve vetomrande advertenties staan vóór de gewone zoekresultaten en zijn herkenbaar aan het advertentielabel. Bij <strong>Binnenkort in de buurt</strong> staat de eerstvolgende evenementdatum vooraan.</p>
  <h3>De details bekijken</h3><ol>
    <li>Klik op de titel, de foto of <strong>Bekijk evenementdetails</strong>.</li>
    <li>Lees de beschrijving, datum, locatie en eventuele prijs.</li>
    <li>Gebruik, indien aanwezig: <strong>Reserveren</strong> om naar de reserveringspagina te gaan; <strong>Website organisator</strong> voor de website van de aanbieder; <strong>Oorspronkelijke informatie</strong> om de bron te bekijken.</li>
    <li>Klik op <strong>Terug naar de agenda</strong> of op het <strong>kruisje rechtsboven</strong> om het detailvenster te sluiten.</li>
  </ol><p>Externe websites openen in een nieuw tabblad. Reserveren gebeurt bij de aanbieder. Controleer daar de actuele beschikbaarheid, openingstijden en prijzen.</p><p>Bij een vaste vermelding, zoals een accommodatie of bedrijf, staat niet altijd een evenementdatum.</p><a className="manual-action" href="/#agenda">Zoek in de agenda →</a></section>

  <section id="gemeentegids"><h2>2. De gemeentegids gebruiken</h2><ol>
    <li>Klik in het menu op <strong>Gemeente informatie</strong>.</li>
    <li>Kies bij <strong>Gemeente of dorp</strong> je gemeente.</li>
    <li>Kies bij <strong>Welke informatie zoek je?</strong> een rubriek. De rubrieken staan alfabetisch, van <strong>Apotheek</strong> tot <strong>Tankstations</strong>. Ook <strong>Makelaars</strong>, de winkelrubrieken, <strong>Openbaar vervoer</strong>, <strong>Parkeren</strong> en <strong>Invalide parkeerplaatsen</strong> staan in deze lijst.</li>
    <li>Voor het complete overzicht kies je <strong>Alle categorieën — complete gemeentegids</strong>. Deze keuze blijft bovenaan staan.</li>
    <li>Klik op <strong>Toon informatie</strong> en wacht op de resultaten onder de zoekvelden.</li>
    <li>Gebruik de getoonde telefoon-, e-mail-, website- en kaartlinks voor contact of een route. Adressen en openingstijden worden getoond wanneer een bron die vermeldt.</li>
  </ol><p>In het complete overzicht staan ook de rubrieken alfabetisch. Per rubriek zie je het aantal vermeldingen en hoeveel daarvan een foto hebben.</p>
  <h3>Foto’s en bronnen</h3><p>Waar een passende foto is gevonden, staat die bij de vermelding. Onder een bronfoto vind je de bronlink en, waar van toepassing, de fotograaf en licentie. Staande foto’s worden volledig getoond. Een door de eigenaar opgeslagen foto krijgt voorrang op een gevonden bronfoto.</p><p><strong>Foto nog niet beschikbaar</strong> betekent dat er geen geschikte bevestigde foto getoond kan worden. De vermelding en contactgegevens blijven gewoon beschikbaar. De fotodekking verschilt per gemeente en rubriek; niet iedere vermelding heeft al een foto.</p>
  <h3>Plaats, afstand en ontbrekende informatie</h3><p>Let op de werkelijke plaats en afstand. Een resultaat met <strong>omgeving</strong> kan buiten de gekozen gemeente liggen. De zoekafstand voor voorzieningen kan verschillen van de gekozen afstand in de evenementenkalender.</p><p>Een ontbrekend resultaat of adres betekent niet automatisch dat de voorziening niet bestaat. Gebruik de aanvullende zoeklinks of vraag informatie bij het gemeentehuis. <strong>Noodnummers</strong> is een informatierubriek met de Franse noodnummers, geen lijst met bedrijven.</p><p>Voor een andere gemeente of rubriek pas je je keuze aan en klik je opnieuw op <strong>Toon informatie</strong>.</p>
  <h3>Je eigen bedrijf beheren of adverteren</h3><p>Bij geschikte bedrijfsvermeldingen staat <strong>Is dit jouw bedrijf? Beheer en adverteer →</strong>. Via deze link bekijk je de bedrijfsgegevens, vraag je beheer aan of kies je advertenties. De gemeentegids en evenementenkalender zijn aparte overzichten: een gidsbedrijf wordt door adverteren geen nieuw evenement.</p><p>Lees <a href="#beheer-aanvragen">beheer aanvragen</a> of <a href="#adverteren-gemeentegids">adverteren in de gemeentegids</a> voor de vervolgstappen.</p><a className="manual-action" href="/#gemeenten">Open de gemeentegids →</a></section>

  <section id="toevoegen"><h2>3. Zelf een evenement of vermelding toevoegen</h2><p>Controleer eerst via de agenda of je evenement of bedrijf al vermeld staat. Staat het er al? Volg dan <a href="#wijzigen">hoofdstuk 4</a> of <a href="#beheer-aanvragen">hoofdstuk 5</a>. Je hoeft voor een wijziging of advertentie geen tweede vermelding aan te maken.</p>
  <h3>De nieuwe invoerpagina</h3><p>Klik in het menu op <strong>Nieuw evenement/vermelding</strong> of <a href="/evenement/nieuw">open de invoerpagina rechtstreeks</a>. Je komt op een aparte pagina met de introductie <strong>Jouw evenement. Meer gezien in Duras.</strong> en het blok <strong>Zo werkt het</strong>. De plaats in deze kop verandert mee met je ingevulde plaats. Bovenaan zie je ook de naam, categorie en plaats van je eigen vermelding terug.</p>
  <p>De pagina gebruikt dezelfde rustige vormgeving als adverteren in de gemeentegids. Je doorloopt achtereenvolgens <strong>Jouw vermelding</strong>, <strong>Hoe wil je opvallen?</strong>, <strong>Zo ziet jouw vermelding eruit.</strong> en <strong>De informatie voor je bezoekers</strong>. Bij een betaalde keuze volgen daarna de factuurgegevens.</p>
  <h3>Je vermelding invullen en je zichtbaarheid kiezen</h3><ol>
    <li>Kies bij <strong>Wat wil je invoeren?</strong> voor <strong>Evenement met datum</strong> of <strong>Vaste vermelding / bedrijf / accommodatie</strong>.</li>
    <li>Vul bij <strong>Jouw vermelding</strong> de <strong>Titel</strong> en <strong>Categorie</strong> in. Voor een categorieadvertentie is de categorie verplicht. Je naam en categorie verschijnen meteen in de voorbeeldkaarten.</li>
    <li>Voeg eventueel een eigen of toegestane foto toe via <strong>Foto van het evenement uploaden</strong>: JPG, PNG of WebP, maximaal 5 MB. De gekozen foto verschijnt in je eigen voorbeeld. Met <strong>Foto verwijderen</strong> haal je de gekozen foto weer uit het formulier. Kiezen is nog geen publiceren: de foto wordt pas met je inzending opgeslagen.</li>
    <li>Vink bij <strong>Hoe wil je opvallen?</strong> één, twee of drie kaarten aan: <strong>Vetomrande vermelding</strong>, <strong>Categorieadvertentie</strong> en <strong>Homepageadvertentie</strong>. De aangevinkte kaarten krijgen een groene rand en de tekst <strong>Toegevoegd aan je keuze</strong>. De maandprijzen staan op de kaarten. Voor een gewone vermelding zonder advertentiekosten kies je <strong>Gratis vermelding</strong>; dit wist alle betaalde keuzes.</li>
    <li>Kies in de balk onder de kaarten de <strong>Looptijd</strong> van 1 tot en met 12 maanden. De balk toont het aantal gekozen advertentievormen, de looptijd en het gezamenlijke totaalbedrag.</li>
    <li>Bekijk bij <strong>Zo ziet jouw vermelding eruit.</strong> je naam, categorie, plaats en gekozen foto. Deze veranderen mee terwijl je het formulier invult. Een vetomrande vermelding wordt boven de gewone voorbeeldresultaten getoond. Categorie- en homepageadvertenties verschijnen in het voorbeeld van de rechterkolom. Je gewone vermelding blijft bestaan.</li>
    <li>Gebruik in het voorbeeld <strong>Pagina</strong> om tussen <strong>Categoriepagina</strong> en <strong>Homepage</strong> te wisselen. Kies bij <strong>Categorie</strong> eventueel een andere voorbeeldcategorie. Zo zie je waar je advertentie wel en niet verschijnt: een categorieadvertentie alleen binnen je eigen categorie, een homepageadvertentie op de homepage. Deze voorbeeldfilters veranderen je echte categorie, advertentiekeuze of ingevulde gegevens niet.</li>
    <li>Bij een betaalde keuze klik je op <strong>Bekijk betaaloverzicht →</strong>. Het venster <strong>Jouw advertentieoverzicht</strong> toont de gekozen vormen, bedragen per vorm, looptijd en het totaal. Dit is nog geen opslag of betaling. Met het kruisje sluit je het venster om je keuze aan te passen. Met <strong>Verder met mijn vermelding →</strong> ga je naar de evenementgegevens. Zonder betaalde keuze kun je die gegevens direct invullen.</li>
  </ol>
  <h3>Gegevens aanvullen en insturen</h3><ol>
    <li>Vul onder <strong>De informatie voor je bezoekers</strong> de <strong>Korte beschrijving</strong> en <strong>Uitgebreide beschrijving</strong> in.</li>
    <li>Vul bij een evenement de <strong>Begindatum en -tijd</strong> en eventueel de <strong>Einddatum en -tijd</strong> in. Bij een vaste bedrijfsvermelding zijn geen evenementdatums nodig.</li>
    <li>Vul de locatie, het adres, de postcode en <strong>Plaats</strong> in. Staat je plaats niet in de lijst? Kies <strong>Andere plaats…</strong> en vul de plaatsnaam in. De plaats in je introductie en voorbeelden verandert mee.</li>
    <li>Geef met <strong>Dit evenement is gratis</strong> aan of bezoekers toegang betalen. Vul anders de prijsgegevens in.</li>
    <li>Vul <strong>Website</strong>, <strong>Reserveringslink</strong> en <strong>Informatiebron</strong> in. Je kunt ook www.voorbeeld.fr invoeren; https:// wordt toegevoegd. Heb je geen aparte reserverings- of bronpagina? Gebruik dan dezelfde website.</li>
    <li>Bij betaalde advertenties vul je bij <strong>Advertentieperiode &amp; factuurgegevens</strong> de begindatum, looptijd en contact- en factuurgegevens in. De gekozen vormen hebben samen één periode en één totaalbedrag. Als je de looptijd aanpast, veranderen de bedragen en de looptijdbalk mee. Je factuurgegevens worden niet openbaar getoond.</li>
    <li>Controleer de verplichte velden. Bij alleen gratis vermelden klik je op <strong>Evenement/vermelding opslaan</strong>. Bij een betaalde keuze klik je op <strong>Opslaan en betalen via Mollie</strong>, met het totaalbedrag in de knop. Je vermelding en alle gekozen vormen worden samen opgeslagen; daarna ga je rechtstreeks naar Mollie voor één betaling. Opnieuw inloggen is niet nodig.</li>
  </ol><p className="manual-tip"><strong>Twee verschillende betekenissen van gratis:</strong> <strong>Gratis vermelding</strong> betekent geen advertentiekosten. <strong>Dit evenement is gratis</strong> gaat over de toegangsprijs voor bezoekers. Je kunt dus ook voor een gratis toegankelijk evenement een betaalde advertentie kiezen.</p>
  <p>Een voorbeeld en een betaaloverzicht zijn nog geen actieve advertentie. Je inzending verschijnt pas na controle door de beheerder. Betaalde advertenties verschijnen daarnaast pas na betaalbevestiging, binnen de gekozen periode en bij beschikbare ruimte. Je gewone vermelding blijft tussen de resultaten staan.</p>
  <h3>Bewaar je persoonlijke beheerlink</h3><p>Na het insturen verschijnt <strong>Je vermelding is ingestuurd — bewaar je beheerlink</strong>.</p><ul>
    <li>Klik op <strong>Beheerlink kopiëren</strong> om de link zelf te bewaren.</li>
    <li>Of klik op <strong>Beheerlink bewaren als bestand</strong>.</li>
    <li>Met <strong>Mijn vermelding beheren</strong> open je het wijzigingsformulier. Op dit apparaat bewaarde vermeldingen zijn ook terug te vinden via <strong>Mijn vermelding</strong>, zolang de browsergegevens bewaard blijven.</li>
  </ul><p className="manual-tip">Bewaar de link als een wachtwoord. Iedereen die de volledige link heeft, kan jouw vermelding beheren. Vertrouw niet uitsluitend op de opslag in je browser. De eerste beheerlink van een nieuwe inzending wordt niet automatisch gemaild; dit verschilt van een later goedgekeurde beheeraanvraag.</p><a className="manual-action" href="/evenement/nieuw">Open de nieuwe invoerpagina →</a></section>

  <section id="wijzigen"><h2>4. Een eigen vermelding of evenement wijzigen</h2><h3>Je hebt al een persoonlijke beheerlink</h3><ol>
    <li>Open je bewaarde beheerlink rechtstreeks, of klik in het menu op <strong>Mijn vermelding</strong>.</li>
    <li>Plak bij <strong>Persoonlijke beheerlink</strong> de volledige link.</li>
    <li>Klik op <strong>Open mijn vermelding</strong>.</li>
    <li>Pas de gewenste gegevens aan, bijvoorbeeld de titel, beschrijving, datum, prijs, contactgegevens of website.</li>
    <li>Klik onderaan op <strong>Wijzigingen opslaan</strong>.</li>
    <li>Wacht op de bevestiging direct onder de knop.</li>
    <li>Open de vermelding opnieuw in de agenda of gemeentegids. Vernieuw de pagina als je nog de vorige gegevens ziet.</li>
  </ol><p>Als de pagina <strong>Op dit apparaat bewaarde vermeldingen</strong> toont, kun je daar ook je vermelding kiezen. Deze lijst is alleen beschikbaar in de browser waarin de links zijn bewaard.</p>
  <h3>Een bedrijf uit de gemeentegids wijzigen</h3><p>Je gebruikt dezelfde persoonlijke beheerlink. Bij een gidsbedrijf kun je ook het zakelijke e-mailadres en de openingstijden aanpassen. De vestigingsgemeente en bedrijfsrubriek horen bij de bestaande vermelding; vraag de beheerder om hulp als die moeten veranderen. Sla gewijzigde gegevens eerst op voordat je advertenties aanvraagt.</p>
  <h3>Een foto toevoegen of vervangen</h3><ol>
    <li>Ga in het wijzigingsformulier naar <strong>Foto vervangen</strong>.</li>
    <li>Klik op <strong>Bestand kiezen</strong>.</li>
    <li>Selecteer een <strong>JPG-, PNG- of WebP-foto van maximaal 5 MB</strong>.</li>
    <li>Controleer het fotovoorbeeld.</li>
    <li>Verkeerde foto gekozen? Klik op <strong>Gekozen foto annuleren</strong> of kies een ander bestand.</li>
    <li>Klik op <strong>Wijzigingen opslaan</strong> en wacht op de bevestiging.</li>
  </ol><p className="manual-tip">Een foto kiezen is nog niet hetzelfde als opslaan. Gebruik een eigen foto of een foto die je mag publiceren. Bij een gemeentegidsbedrijf vervangt je opgeslagen foto de gevonden bronfoto in de openbare weergave.</p>
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
    <li>Vul je naam, e-mailadres, organisatie, eventueel telefoonnummer en <strong>Jouw functie en toelichting</strong> in. Leg uit waarom je namens de organisatie mag handelen.</li>
    <li>Vink de toestemming voor het behandelen van je verzoek aan.</li>
    <li>Klik op <strong>Verzoek versturen</strong>.</li>
    <li>Bewaar de referentie die in de ontvangstmelding verschijnt.</li>
  </ol><p>Je aanvraag geeft nog geen wijzigingsrechten. De beheerder controleert eerst of je namens de organisatie mag handelen, via onafhankelijk gevonden officiële contactgegevens. Na goedkeuring wordt de persoonlijke beheerlink naar het door de beheerder gecontroleerde e-mailadres gemaild. Open die link om je gegevens te beheren of advertenties te kiezen. Controleer ook je spammap als de mail niet aankomt en neem zo nodig contact op met je aanvraagreferentie.</p><h3>Voor een bedrijf in de gemeentegids</h3><ol><li>Zoek het bedrijf in de juiste gemeente en rubriek.</li><li>Klik op <strong>Is dit jouw bedrijf? Beheer en adverteer →</strong>.</li><li>Klik op <strong>Beheer en adverteer →</strong> en vervolgens op <strong>Beheer of correctie aanvragen</strong>.</li><li>Kies <strong>Deze vermelding beheren</strong> en vul het aanvraagformulier in zoals hierboven.</li></ol><p>Je hoeft het bedrijf niet opnieuw toe te voegen. Voor een nieuwe inzending die je zelf hebt aangemaakt, bewaar je de beheerlink die direct na het insturen op het scherm verschijnt; die eerste link wordt niet automatisch gemaild.</p></section>

  <section id="correctie"><h2>6. Een fout doorgeven zonder beheerrechten</h2><p>Wil je alleen verkeerde informatie melden?</p><ol>
    <li>Open de vermelding via <strong>Bekijk evenementdetails</strong>. Bij een gemeentegidsbedrijf open je <strong>Is dit jouw bedrijf? Beheer en adverteer →</strong>, daarna <strong>Beheer en adverteer →</strong> en <strong>Beheer of correctie aanvragen</strong>.</li>
    <li>Klik op <strong>Correctie doorgeven</strong>.</li>
    <li>Vul je naam en e-mailadres in.</li>
    <li>Beschrijf bij <strong>Wat moet worden gecorrigeerd?</strong> wat onjuist is, wat de juiste informatie is en waar dit gecontroleerd kan worden.</li>
    <li>Vink de toestemming aan en klik op <strong>Verzoek versturen</strong>.</li>
    <li>Bewaar de referentie uit de ontvangstmelding.</li>
  </ol><p>De beheerder beoordeelt je melding. Een correctiemelding past de vermelding niet direct aan en geeft geen beheerrechten.</p></section>

  <section id="advertenties"><h2>7. Adverteren met een evenement of bestaande vermelding</h2><p>Je kunt een bestaande vermelding extra laten opvallen. De tekst, foto, datum en persoonlijke beheerlink blijven behouden; een tweede evenement aanmaken is niet nodig.</p>
  <h3>De drie advertentievormen in de agenda</h3><ul>
    <li><strong>Vetomrande vermelding:</strong> je bestaande resultaat krijgt een opvallende donkergroene rand en een advertentielabel. Actieve vetomrande vermeldingen staan bovenaan de zoekresultaten.</li>
    <li><strong>Categorieadvertentie:</strong> een extra advertentiekaart bij de uitgelichte partners van je categorie.</li>
    <li><strong>Homepageadvertentie:</strong> een extra advertentiekaart bij de uitgelichte partners op de homepage.</li>
  </ul><p>Ook met een advertentie in de rechterkolom blijft je vermelding tussen de gewone resultaten staan. Je kunt alle drie de vormen voor dezelfde vermelding combineren. De voorbeelden op het keuzescherm tonen het verschil met een normale vermelding; een voorbeeld is nog geen actieve advertentie.</p>
  <h3>Een bestaande vermelding upgraden en samen betalen</h3><ol>
    <li>Open je persoonlijke beheerlink. Of open de evenementdetails en kies <strong>Advertentie toevoegen / upgraden →</strong>; plak vervolgens je beheerlink. Heb je die nog niet? <a href="#beheer-aanvragen">Vraag eerst beheer aan</a>.</li>
    <li>Ga naar <strong>Meer bereik voor deze vermelding</strong>. Heb je gegevens aangepast? Sla die eerst op.</li>
    <li>Vink één, twee of drie advertentievormen aan. Bekijk het voorbeeld en het gezamenlijke bedrag.</li>
    <li>Vul de begindatum, looptijd en factuurgegevens in. Het overzicht toont de gekozen vormen, de periode en het totaal.</li>
    <li>Klik op <strong>Verder naar Mollie</strong>. Je kiest je betaalmethode in de beveiligde betaalomgeving en betaalt de gekozen vormen in één keer. Opnieuw inloggen voor de betaling is niet nodig.</li>
  </ol><p>Een vorm die al betaald of aangevraagd is, kan niet nogmaals aan dezelfde keuze worden toegevoegd. Voor homepage- en categorieadvertenties wordt eerst gecontroleerd of er ruimte is in de gekozen periode. Bij onvoldoende ruimte blijft je bestaande vermelding behouden, maar kan de betaling niet worden gestart; pas de keuze aan of vraag de beheerder om hulp.</p>
  <h3>Bij een nieuwe inzending</h3><p>Ook bij een <a href="/evenement/nieuw">nieuwe vermelding</a> kun je meteen één, twee of alle drie de advertentievormen combineren. Je ziet vooraf je eigen voorbeelden en één betaaloverzicht. Daarna vul je de evenement- en factuurgegevens in en gebruik je <strong>Opslaan en betalen via Mollie</strong> voor één gezamenlijke betaling. Je hoeft hiervoor niet eerst naar de persoonlijke beheerpagina. De volledige werkwijze staat in <a href="#toevoegen">hoofdstuk 3</a>.</p><p>Een advertentie verschijnt pas na goedkeuring en betaalbevestiging en uitsluitend binnen de gekozen periode. Lukt het openen van Mollie niet, lees dan de melding en probeer het vanuit dezelfde vermelding opnieuw; maak niet direct een tweede vermelding aan.</p><a className="manual-action" href="/mijn-vermelding">Open Mijn vermelding →</a></section>

  <section id="adverteren-gemeentegids"><h2>8. Adverteren in de gemeentegids</h2><p>De advertentiepagina’s voor gemeentegids en evenementenkalender hebben dezelfde opbouw: een introductie met je eigen vermelding, drie keuzekaarten, een looptijdbalk, visuele voorbeelden en een betaaloverzicht. Gidsbedrijven hebben wel eigen advertentiemogelijkheden, gericht op hun vestigingsgemeente. Deze staan los van de advertentieplekken in de evenementenkalender.</p><ul>
    <li><strong>Vetomrande vermelding:</strong> je bestaande bedrijf valt extra op en staat bovenaan binnen de betreffende gemeente en rubriek.</li>
    <li><strong>Rubriekpartner:</strong> een extra advertentiekaart in de rechterkolom bij je bedrijfsrubriek en gemeente.</li>
    <li><strong>Gemeentepartner:</strong> een extra advertentiekaart bij alle rubrieken van je gemeente.</li>
  </ul><ol>
    <li>Zoek je bedrijf in de gemeentegids en klik op <strong>Is dit jouw bedrijf? Beheer en adverteer →</strong>.</li>
    <li>Vink bij <strong>Hoe wil je opvallen?</strong> één of meer advertentievormen aan en kies de looptijd. De actuele maandprijzen en het totaal staan op het scherm.</li>
    <li>Bekijk onder <strong>Zo ziet jouw vermelding eruit</strong> het voorbeeld met je eigen bedrijfsnaam. Wissel de voorbeeldgemeente of rubriek om het bereik van de gekozen vorm te zien. Dit wijzigt je echte vestigingsgemeente of rubriek niet.</li>
    <li>Klik op <strong>Bekijk betaaloverzicht →</strong> en controleer alle gekozen vormen en het totaalbedrag.</li>
    <li>Klik op <strong>Verder naar beheer en betalen →</strong>. Gebruik je persoonlijke beheerlink. Zonder beheerlink kun je op deze pagina <strong>Beheer of correctie aanvragen</strong> kiezen; na controle ontvang je de link per e-mail.</li>
    <li>Controleer in je beheerpagina de overgenomen keuze, begindatum, looptijd en factuurgegevens. Klik op <strong>Verder naar Mollie</strong> voor één gezamenlijke betaling.</li>
  </ol><p>Je bedrijf blijft in de normale gidsresultaten staan, ook als je rubriekpartner of gemeentepartner bent. De beschikbaarheid voor partners wordt gecontroleerd per gemeente en, bij rubriekpartners, per rubriek. Plaatsing volgt na goedkeuring en betaalbevestiging binnen de gekozen periode.</p><a className="manual-action" href="/#gemeenten">Kies je bedrijf in de gemeentegids →</a></section>

  <section id="hulp"><h2>9. Andere onderdelen en hulp</h2><ul>
    <li><strong>De streek beleven:</strong> uitleg over de website en de regio. Met <strong>Ontdek de agenda</strong> ga je naar het zoekscherm.</li>
    <li><strong>Ontdekken:</strong> snel naar de agenda of gemeentegids.</li>
    <li><strong>Contactgegevens:</strong> onderaan de website vind je hoe je Côte de Duras kunt bereiken.</li>
    <li><strong>Statistiekvoorkeuren:</strong> onderaan de website kun je je keuze voor het meten van websitegebruik aanpassen.</li>
  </ul><p>Voor hulp kun je mailen naar <a href="mailto:info@cotededuras.com">info@cotededuras.com</a>. Vermeld de titel van de betreffende vermelding en eventueel je aanvraagreferentie. Stuur je persoonlijke beheerlink niet mee in een openbaar bericht.</p></section>
  <section id="voor-beheerders"><h2>10. Voor beheerders</h2><p>De onderstaande handelingen zijn alleen beschikbaar na de <strong>Beheerderslogin</strong>. Een bezoeker met een persoonlijke beheerlink beheert uitsluitend de eigen vermelding.</p>
  <h3>De juiste website kiezen</h3><p>Controleer na inloggen <strong>Je bewerkt nu</strong>. Kies zo nodig bij <strong>Welke evenementenkalender wil je beheren?</strong> een andere website en klik op <strong>Open beheer van …</strong>. Je opent de eigen omgeving van die site; vermeldingen worden niet verplaatst. Omgevingen met het label <strong>demo</strong> zijn voorbeelden waarvan wijzigingen lokaal in je browser blijven.</p>
  <h3>Een beheeraanvraag goedkeuren en de sleutel mailen</h3><ol>
    <li>Open <strong>Beheeraanvragen &amp; correctiemeldingen</strong> en bekijk de aanvraag.</li>
    <li>Controleer de bevoegdheid via contactgegevens die je zelf op de officiële website of in de oorspronkelijke bron vindt.</li>
    <li>Kies de passende beslissing. Voor beheer verlenen of herstellen leg je het gecontroleerde contactkanaal, de officiële bron en de uitgevoerde controle vast.</li>
    <li>Controleer <strong>E-mailadres voor de persoonlijke beheerlink</strong> en vink aan dat dit adres bij de bevoegde eigenaar hoort.</li>
    <li>Klik op <strong>Beslissing vastleggen</strong>. Na een geslaagde goedkeuring sluit het formulier en wordt de beheerlinkmail naar de gecontroleerde ontvanger verstuurd.</li>
    <li>Lees de bevestiging en verzendstatus. <strong>Door Strato geaccepteerd</strong> is een verzendbevestiging, geen bewijs dat de ontvanger de mail al heeft gelezen. Bij een fout controleer je de actuele aanvraagstatus voordat je opnieuw opslaat.</li>
  </ol><p>Herstel van een beheerlink maakt oude links ongeldig. Een correctiemelding afhandelen verandert de inhoud niet automatisch: pas een evenement aan bij <strong>Alle evenementen</strong> of een gidsbedrijf bij <strong>Gemeentegids · Bedrijven beheren</strong> en rond daarna de melding af.</p>
  <h3>Gemeentegidsbedrijven en foto’s aanpassen</h3><ol>
    <li>Open <strong>Gemeentegids · Bedrijven beheren</strong>.</li>
    <li>Filter op <strong>Gemeente</strong> en <strong>Rubriek</strong>. Gebruik <strong>Vorige</strong> en <strong>Volgende</strong> voor de overige pagina’s.</li>
    <li>Kies <strong>Bedrijfsgegevens aanpassen</strong>. Pas naam, adres, telefoon, zakelijk e-mailadres, openingstijden, website of beschrijving aan.</li>
    <li>Voor een eigen of toegestane bronfoto vul je een volledig foto-adres in bij <strong>Foto-adres (eigen foto of toegestane bron)</strong>. Dit is een afbeeldingsadres, geen gewone webpagina. Een eigenaar kan via de persoonlijke beheerpagina ook een fotobestand uploaden.</li>
    <li>Klik op <strong>Opslaan</strong> en controleer de openbare weergave in de juiste gemeentegidsrubriek.</li>
  </ol><p>Dit overzicht bevat de voor beheer geregistreerde bedrijven. Niet iedere openbare bronvermelding hoeft daar al geregistreerd te zijn. Gemeentegidsbedrijven staan apart van de evenementenkalender. Advertentieaanvragen en betalingen controleer je bij <strong>Advertentieaanvragen</strong>.</p>
  <h3>Een rapport opslaan</h3><ol>
    <li>Open <strong>Bezoekers &amp; advertentiebereik</strong> en kies de periode.</li>
    <li>Klik zo nodig op <strong>Vernieuwen</strong> en wacht tot het rapport geladen is.</li>
    <li>Kies <strong>Excel opslaan als…</strong> of <strong>CSV opslaan als…</strong> en sla het bestand op je apparaat op. Er hoeft geen nieuwe webpagina te openen.</li>
    <li>Open het opgeslagen bestand in Excel of een ander spreadsheetprogramma. Met <strong>Volledig rapport direct bekijken</strong> lees je de rapportonderdelen ook binnen de beheermodule.</li>
  </ol><p>Het rapport bevat de onderdelen voor de gekozen periode. De bezoekcijfers betreffen gemeten bezoeken waarvoor toestemming is gegeven.</p></section>
  <nav className="manual-bottom-nav" aria-label="Verder navigeren"><a href="#handleiding-top">↑ Terug naar de inhoud</a><a href="/#agenda">Naar de agenda →</a></nav>
</main>}
