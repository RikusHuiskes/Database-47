import {localizeMetadata} from '../i18n/server';

import {T, A} from '../i18n/Language';
import type {Metadata} from 'next';
import Image from 'next/image';
const sourceMetadata:Metadata={title:'De streek beleven | Côte de Duras'};
export async function generateMetadata(){return localizeMetadata(sourceMetadata);}

export default function RegionIntroduction(){return <main className="region-introduction">
  <A><nav aria-label="Navigatie"><a href="/"><T>{"Côte de Duras"}</T></a><a href="/#agenda"><T>{"Naar de agenda →"}</T></a></nav></A>
  <p className="section-kicker"><T>{"De streek beleven"}</T></p><h1><T>{"Ontdek alles rond Duras op één plek"}</T></h1>
  <figure className="region-banner">
    <Image className="region-landscape" src="/streek-duras.jpg" fill sizes="(max-width: 680px) calc(100vw - 68px), (max-width: 964px) calc(100vw - 64px), 834px" preload alt="Zomers landschap met hooibalen op een geoogst veld, groene bomen en een blauwe lucht" />
    <figcaption><strong><T>{"50 kilometer rond Duras."}</T></strong><span><T>{"Alles wat je wilt weten, vinden en beleven."}</T></span><strong><T>{"Eén website."}</T></strong></figcaption>
  </figure>
  <p className="intro-lead"><strong><T>{"Wat is er vandaag te doen? Waar kun je lekker eten? Welke markt is er morgen? Waar vind je een mooie gîte, een bijzonder château, een wijnproeverij of een evenement in de buurt? En waar is de dichtstbijzijnde huisarts, supermarkt of laadpaal?"}</T></strong></p>
  <p><T>{"Côte de Duras brengt het allemaal samen."}</T></p>
  <p><T>{"Wij verzamelen activiteiten, evenementen, restaurants, markten, winkels, bezienswaardigheden, accommodaties, praktische voorzieningen en andere interessante adressen binnen een straal van "}</T><strong><T>{"50 kilometer rond Duras"}</T></strong><T>{"."}</T></p>
  <p><T>{"Ons doel is eenvoudig: "}</T><strong><T>{"één centrale website die uitgroeit tot de meest complete gids van de regio."}</T></strong></p>
  <p><T>{"Geen eindeloos zoeken op tientallen websites, Facebookpagina’s en verschillende lokale agenda’s. Op Côte de Duras vind je alles overzichtelijk bij elkaar en kun je zoeken op "}</T><strong><T>{"plaats, afstand en categorie"}</T></strong><T>{"."}</T></p>
  <h2><T>{"Voor inwoners én bezoekers"}</T></h2>
  <p><T>{"Of je hier woont, een tweede huis hebt, op vakantie bent of de streek voor het eerst bezoekt: Côte de Duras helpt je ontdekken wat deze prachtige regio te bieden heeft."}</T></p>
  <p><T>{"Van een vide-grenier in een klein dorp tot een concert, restaurant, wijnproeverij, markt, festival, wandeling, museum of bijzondere plek die je anders misschien nooit had gevonden."}</T></p>
  <p><T>{"En omdat we zoeken en verzamelen binnen "}</T><strong><T>{"50 kilometer rond Duras"}</T></strong><T>{", stopt de ontdekking niet bij een gemeente- of departementsgrens."}</T></p>
  <h2><T>{"De gemeentegids: praktische informatie binnen handbereik"}</T></h2>
  <p><T>{"Côte de Duras is niet alleen bedoeld om te ontdekken wat er te beleven is. De website bevat ook een uitgebreide "}</T><strong><T>{"gemeentegids met praktische en relevante informatie over de plaatsen in de regio"}</T></strong><T>{"."}</T></p>
  <p><T>{"Zo vind je snel informatie over bijvoorbeeld het "}</T><strong><T>{"gemeentehuis, supermarkten, winkels, apotheken, medische diensten, toeristische informatie, elektrische laadpalen, openbaar vervoer, afvalinzameling en andere belangrijke lokale voorzieningen"}</T></strong><T>{"."}</T></p>
  <p><T>{"Ideaal voor inwoners, maar minstens zo handig wanneer je hier op vakantie bent of net in de regio bent komen wonen."}</T></p>
  <p><T>{"Zo hoef je ook voor praktische vragen niet meer verschillende websites af te zoeken: "}</T><strong><T>{"Côte de Duras brengt lokale informatie samen op één centrale plek."}</T></strong></p>
  <h2><T>{"Eén regio. Eén plek. Steeds completer."}</T></h2>
  <p><T>{"Côte de Duras is voortdurend in ontwikkeling. Nieuwe evenementen, locaties, voorzieningen en activiteiten worden toegevoegd, zodat een steeds completer en actueler beeld ontstaat van wat er in onze omgeving te beleven én te vinden is."}</T></p>
  <p><T>{"Daarmee willen we niet alleen bezoekers en inwoners helpen, maar ook lokale ondernemers, verenigingen en organisatoren een groter podium geven."}</T></p>
  <h2><T>{"Ben je ondernemer of organisator?"}</T></h2>
  <p><T>{"Een "}</T><strong><T>{"basisvermelding is gratis"}</T></strong><T>{". Zo kan iedere lokale ondernemer, accommodatie, organisatie of organisator onderdeel worden van Côte de Duras."}</T></p>
  <p><T>{"Wil je extra opvallen?"}</T></p>
  <p><T>{"Dan kun je tegen betaling jouw bedrijf, accommodatie, restaurant, activiteit of evenement "}</T><strong><T>{"prominent onder de aandacht brengen"}</T></strong><T>{". Zo bereik je precies de mensen die actief zoeken naar wat er in deze regio te zien, doen, beleven, boeken en ontdekken is."}</T></p>
  <h2><T>{"Ontdek de regio. Ook buiten de gebaande paden."}</T></h2>
  <p><T>{"De streek rond Duras heeft ontzettend veel te bieden. Soms zijn juist de kleinste evenementen, bijzondere adressen, lokale ondernemers en handige voorzieningen het moeilijkst te vinden."}</T></p>
  <p><strong><T>{"Côte de Duras maakt ze zichtbaar én vindbaar."}</T></strong></p>
  <a className="button button-dark" href="/#agenda"><T>{"Ontdek de agenda →"}</T></a>
</main>}
