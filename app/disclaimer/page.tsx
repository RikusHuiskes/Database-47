import type { Metadata } from "next";

export const metadata: Metadata = { title: "Disclaimer | Côte de Duras" };

export default function DisclaimerPage() {
  return <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px", lineHeight: 1.8 }}>
    <a href="/">← Terug naar Côte de Duras</a>
    <h1>Disclaimer</h1>
    <p>Côte de Duras is een informatieplatform voor evenementen, lokale informatie en advertenties. Wij besteden zorg aan de inhoud, maar kunnen de juistheid, volledigheid, actualiteit en voortdurende beschikbaarheid van de informatie niet garanderen. Informatie kan afkomstig zijn van bezoekers, organisatoren, adverteerders en andere externe bronnen en kan fouten of onvolledigheden bevatten.</p>
    <p>Controleer belangrijke gegevens, zoals data, openingstijden, prijzen, locaties en voorwaarden, altijd rechtstreeks bij de betreffende organisator of aanbieder voordat u vertrekt, reserveert of een aankoop doet. Het gebruik van de website en het vertrouwen op de aangeboden informatie gebeurt op eigen verantwoordelijkheid.</p>
    <p>Voor zover wettelijk toegestaan, aanvaarden Côte de Duras en haar eigenaren en initiatiefnemers geen aansprakelijkheid voor directe of indirecte schade die voortvloeit uit het gebruik of de onbeschikbaarheid van deze website, onjuiste, onvolledige of verouderde informatie, advertenties of informatie op websites van derden. Dit geldt voor bezoekers, adverteerders en ieder ander die de website of onderdelen daarvan gebruikt. Voor zover deze aansprakelijkheid rechtsgeldig is uitgesloten, bestaat geen aanspraak op schadevergoeding.</p>
    <p>Organisatoren, adverteerders en andere aanleverende partijen zijn verantwoordelijk voor hun eigen inhoud, aanbiedingen en dienstverlening. Een vermelding, controle of advertentie op Côte de Duras vormt geen garantie of aanbeveling. Wij garanderen geen bezoekersaantallen, reserveringen, omzet of ander advertentieresultaat.</p>
    <p>Deze disclaimer beperkt geen wettelijke rechten van consumenten en sluit geen aansprakelijkheid uit die volgens het toepasselijke recht niet mag worden uitgesloten, waaronder aansprakelijkheid bij opzet of grove schuld. Dwingende wettelijke verplichtingen en uitdrukkelijk overeengekomen verplichtingen blijven gelden.</p>
    <p><small>Laatst bijgewerkt: 28 oktober 2026.</small></p>
  </main>;
}
