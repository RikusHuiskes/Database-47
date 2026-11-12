# Côte de Duras — voorbereiding maandelijkse SEPA-incasso

Datum: 12 november 2026  
Status: technisch ontwerp; geen betaalgedrag gewijzigd, geen incasso's gestart.

## Doel en vaststaande uitgangspunten

Ondernemers kunnen hun advertentie maandelijks betalen via Mollie, zonder de volledige gekozen looptijd vooruit te betalen. De eigenaar meldt dat Mollie SEPA Direct Debit heeft geactiveerd. Dit is in deze voorbereiding niet met een live API-aanroep gecontroleerd.

Bestaande tarieven en betaalde campagnes blijven behouden. Bestaande eenmalige betalingen geven geen toestemming voor toekomstige incasso; daarvoor is afzonderlijke toestemming nodig.

## Gecontroleerde bestaande code

| Onderdeel | Bevinding | Gevolg voor implementatie |
| --- | --- | --- |
| `lib/advertising.ts` | Maandprijzen: vetomrande vermelding €15, categorie €79, homepage €149. Gekozen looptijd 1–12 maanden; offerte telt alle maanden bij elkaar op. | Toon maandbedrag, looptijd en eventuele totale verplichting afzonderlijk. Prijzen blijven uit de serverconfiguratie komen. |
| `app/api/mollie/checkout/route.ts` | Eén betaling voor het volledige aanvraagbedrag; geen customerId of sequenceType. | Nieuwe maandbetaalroute naast de bestaande route, met Mollie-klant en expliciete machtiging. |
| `app/api/mollie/webhook/route.ts` | Zoekt eerst een aanvraag op via het al opgeslagen mollie_payment_id. | Door Mollie aangemaakte vervolgbetalingen zijn vooraf niet bekend. Nieuwe webhook moet ze veilig herkennen aan opgeslagen subscription/customer en metadata. |
| `lib/mollie.ts` | Controleert het hele aanvraagbedrag en requestId. | Vervolgtermijn vergelijken met het maandbedrag en de contractgegevens; niet met het jaarbedrag. |
| `supabase/migrations/20261101104701_single_payment_advertising_selection.sql` | Aanvraag bewaart totaalbedrag, looptijd, plaatsingen en capaciteit voor de periode. | Contract, termijnen en betaalde zichtbaarheid scheiden; eerste termijn mag niet automatisch twaalf maanden als volledig betaald markeren. |
| `supabase/migrations/20261104170000_advertising_invoices.sql` | Factuur heeft een unieke request_id en gebruikt het volledige aanvraagbedrag. | Bewuste factuurkeuze nodig: maandfacturen met nieuwe termijnkoppeling óf één contractfactuur met deelbetalingen. Geen twaalf identieke jaarfacturen maken. |
| `lib/advertising-invoices.ts` | Bestaande factuurinstellingen, PDF en mailwachtrij. | Hergebruiken na keuze facturering; geen nieuwe maildienst nodig. |

Deze bevindingen betreffen de repository. Live database, omgevingsvariabelen en Mollie-account zijn niet gewijzigd of volledig geaudit.

## Besluit voor de bouw

**Maandelijks betalen is niet hetzelfde als maandelijks opzegbaar.**

Te kiezen door Rikus vóór activatie:
1. Een vaste gekozen looptijd, betaald in maandtermijnen; of
2. Een doorlopend abonnement met afgesproken maandelijkse opzegging.

Ook vastleggen: opzegmoment, behandeling van mislukte termijnen, eventuele respijtperiode en facturering per maand of per contract. De betaalpagina toont deze afspraken vóór toestemming, in FR/NL/EN. Geen tariefwijziging of automatische contractverlenging toevoegen zonder besluit.

## Voorgestelde klantreis

1. Ondernemer kiest advertentie, begindatum en maandelijkse betaling.
2. Overzicht toont maandbedrag, eerste betaaldatum, contractduur/opzegvoorwaarden en expliciete toestemming voor terugkerende SEPA-incasso. Bewaar de versie van de geaccepteerde tekst en het tijdstip.
3. Server maakt een Mollie-klant en een eerste betaling aan met `customerId` en `sequenceType: "first"`. Alleen een betaalmethode aanbieden die een directdebit-machtiging oplevert; een kaartbetaling levert een andere machtiging op. Beschikbare eerste methoden voor Franse ondernemers eerst in testmodus verifiëren.
4. Na bevestiging via Mollie's API controleert de server het betaalbedrag, de juiste klant, de gekozen advertentie en een geldige directdebit-machtiging.
5. De eerste betaling geldt als eerste maandtermijn. Daarna maakt de server één abonnement aan met `interval: "1 month"`, `method: "directdebit"` en het maandbedrag; volgende startdatum is het einde van de eerste betaalde periode.
6. Bij een eindige looptijd N: nog N−1 vervolgtermijnen. Bij N=1 geen abonnement aanmaken. Bij doorlopend: geen vast aantal termijnen, wel expliciete opzegafhandeling.
7. Ondernemer ontvangt bevestiging, een overzicht van komende bedragen/data en passende incassoberichten. Beheer toont contract, machtiging, betaalde periode en uitzonderingen.

Een rechtstreekse IBAN-machtiging via de Mandates API bestaat ook, maar is een afzonderlijk te beoordelen toestemmingsroute als de eerste betaalroute onvoldoende past bij Franse banken. Geen onnodige opslag van ruwe IBAN's in onze database of logs.

## Benodigde technische uitbreiding

Voorgesteld datamodel, nog niet toegepast:

- Contract: eigenaar/vermelding, plaatsingen, vastgelegd maandbedrag, valuta, start/einddatum, looptijdtype, opzegstatus, voorwaardenversie en test/live-modus.
- Mollie-koppelingen: customerId, mandateId, subscriptionId en eerste paymentId, alleen servermatig wijzigbaar.
- Termijnen: uniek paymentId, periode, bedrag, betaalstatus en eventuele terugbetaling/stornering. Onderscheid normale termijnen van expliciete herstelbetalingen.
- Betrouwbare wachtrij voor abonnementaanmaak, opzegging en mail, met unieke sleutels en herstel na onderbroken API-aanroepen.
- Serverbevoegdheden en eigenaarstoegang aansluiten op de bestaande persoonlijke beheerlinks en RLS.

Webhook-flow:
- Vertrouw nooit status, bedrag of eigenaarschap uit de callback of retour-URL.
- Haal betaling opnieuw op met de Mollie-servercredential; controleer test/live, customerId, subscriptionId, metadata, valuta en termijnbedrag.
- Sla ook de eerste callback van een nieuwe vervolgbetaling veilig op; reageer pas succesvol na duurzame verwerking.
- Herhaalde of verkeerd geordende callbacks mogen geen dubbele termijn, activatie, factuur of mail veroorzaken.
- Onbekende betalingen blijven ongekoppeld en worden gemeld; nooit koppelen op alleen e-mailadres.
- Mislukte incasso, ingetrokken machtiging en stornering hebben afzonderlijke statussen. Niet onbeperkt opnieuw incasseren en niet onmiddellijk de gratis basisvermelding verwijderen.
- Mollie kan eigen retries doen; eigen herstelbetalingen eerst hierop afstemmen.
- Opzegging moet Mollie's abonnement beëindigen en de afgesproken einddatum lokaal bewaren. Verifieer reeds aangemaakte betalingen afzonderlijk; abonnementstop is geen terugbetaling.

Capaciteit en zichtbaarheid: bij vaste looptijd capaciteit voor die afspraak reserveren, maar betaalde dekking per termijn bijhouden. Bij doorlopend alleen bevestigde toekomstige capaciteit toezeggen. Respijt en vrijgave afhangen van de commerciële keuze hierboven.

## Controlelijst vóór livegang

- Testmodus eerst; geen live sleutel in previews, geen echte klant incasseren voor een technische test.
- Eén en twaalf maanden; eerste termijn niet dubbel; voor twaalf maanden precies elf vervolgtermijnen.
- Begindata op 28/29/30/31 januari en februari; kalendermaanden gebruiken, geen stappen van dertig dagen.
- Uitgestelde campagne: eerste betaling en dekking correct afstemmen op campagnestart.
- Dubbel klikken, dubbele webhook, gelijktijdige verwerking en timeout na succesvolle Mollie-aanmaak.
- Vervolgbetaling zonder vooraf opgeslagen paymentId; fout customerId, subscriptionId, bedrag of test/live afwijzen.
- Onvoldoende saldo, verlopen/ingetrokken machtiging, stornering en terugbetaling.
- Opzegging vóór en na een reeds aangemaakte volgende incasso.
- Combinatie van plaatsingen en beschikbare capaciteit.
- Facturen tellen termijnen niet dubbel; bestaande facturen blijven onveranderd.
- Beheer en klantmails tonen juiste bedragen, periodes en taal.
- Bestaande eenmalige checkout en betaalde campagnes blijven werken.

## Uitvoerbare volgorde voor de volgende sessie

1. Commerciële afspraken en factuurvorm kiezen.
2. Bestaande live schema's, factuurinstellingen en Mollie-betaalmethoden read-only controleren.
3. Additieve migratie, termijnlogica en nieuwe checkout/webhook-route bouwen op werkbranch.
4. Beheer en betaalkeuze in FR/NL/EN toevoegen.
5. Volledige testflow met testklant en testmachtiging doorlopen.
6. Daarna gecontroleerd live activeren voor nieuwe, expliciet gemachtigde abonnementen.

## Officiële Mollie-bronnen

Gecontroleerd op 12 november 2026:
- https://docs.mollie.com/docs/recurring-payments
- https://docs.mollie.com/docs/sepa-direct-debit
- https://docs.mollie.com/reference/create-subscription
- https://docs.mollie.com/reference/create-mandate
