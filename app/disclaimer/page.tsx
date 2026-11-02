import {localizeMetadata} from '../i18n/server';

import {T, A} from '../i18n/Language';
import type { Metadata } from "next";

const sourceMetadata: Metadata = { title: "Disclaimer | Côte de Duras" };
export async function generateMetadata(){return localizeMetadata(sourceMetadata);}


export default function DisclaimerPage() {
  return <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px", lineHeight: 1.8 }}>
    <a href="/"><T>{"← Terug naar Côte de Duras"}</T></a>
    <h1><T>{"Disclaimer"}</T></h1>
    <p><T>{"Côte de Duras is een informatieplatform voor evenementen, lokale informatie en advertenties. Wij besteden zorg aan de inhoud, maar kunnen de juistheid, volledigheid, actualiteit en voortdurende beschikbaarheid van de informatie niet garanderen. Informatie kan afkomstig zijn van bezoekers, organisatoren, adverteerders en andere externe bronnen en kan fouten of onvolledigheden bevatten."}</T></p>
    <p><T>{"Controleer belangrijke gegevens, zoals data, openingstijden, prijzen, locaties en voorwaarden, altijd rechtstreeks bij de betreffende organisator of aanbieder voordat u vertrekt, reserveert of een aankoop doet. Het gebruik van de website en het vertrouwen op de aangeboden informatie gebeurt op eigen verantwoordelijkheid."}</T></p>
    <p><T>{"Voor zover wettelijk toegestaan, aanvaarden Côte de Duras en haar eigenaren en initiatiefnemers geen aansprakelijkheid voor directe of indirecte schade die voortvloeit uit het gebruik of de onbeschikbaarheid van deze website, onjuiste, onvolledige of verouderde informatie, advertenties of informatie op websites van derden. Dit geldt voor bezoekers, adverteerders en ieder ander die de website of onderdelen daarvan gebruikt. Voor zover deze aansprakelijkheid rechtsgeldig is uitgesloten, bestaat geen aanspraak op schadevergoeding."}</T></p>
    <p><T>{"Organisatoren, adverteerders en andere aanleverende partijen zijn verantwoordelijk voor hun eigen inhoud, aanbiedingen en dienstverlening. Een vermelding, controle of advertentie op Côte de Duras vormt geen garantie of aanbeveling. Wij garanderen geen bezoekersaantallen, reserveringen, omzet of ander advertentieresultaat."}</T></p>
    <p><T>{"Deze disclaimer beperkt geen wettelijke rechten van consumenten en sluit geen aansprakelijkheid uit die volgens het toepasselijke recht niet mag worden uitgesloten, waaronder aansprakelijkheid bij opzet of grove schuld. Dwingende wettelijke verplichtingen en uitdrukkelijk overeengekomen verplichtingen blijven gelden."}</T></p>
    <p><small><T>{"Laatst bijgewerkt: 28 oktober 2026."}</T></small></p>
  </main>;
}
