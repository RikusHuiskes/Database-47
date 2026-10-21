import test from "node:test";
import assert from "node:assert/strict";
import { enrichTourismeDurasEvent, parseFrenchEventDate, parseTourismeDurasHtml } from "./tourisme-duras.ts";

const referenceDate = new Date("2026-10-19T08:00:00Z");

test("parses a French single date and 24-hour time in the Paris timezone", () => {
  assert.deepEqual(
    parseFrenchEventDate("Le lundi 19 octobre 2026 à 14h30", referenceDate),
    { start_at: "2026-10-19T14:30:00+02:00", end_at: null },
  );
});

test("tolerates a missing space after the weekday in the source date", () => {
  assert.deepEqual(
    parseFrenchEventDate("Le mercredi11 novembre 2026 à partir de 8h", referenceDate),
    { start_at: "2026-11-11T08:00:00+01:00", end_at: null },
  );
});

test("parses a date range when the start date omits its month", () => {
  assert.deepEqual(
    parseFrenchEventDate("Du lundi 19 au vendredi 30 octobre 2026", referenceDate),
    { start_at: "2026-10-19T10:00:00+02:00", end_at: "2026-10-30T10:00:00+01:00" },
  );
});

test("parses a range that crosses months and abbreviated month names", () => {
  assert.deepEqual(
    parseFrenchEventDate("Du 17 octobre au 1er nov. (sauf 18, 23, 31)", referenceDate),
    { start_at: "2026-10-17T10:00:00+02:00", end_at: "2026-11-01T10:00:00+01:00" },
  );
});

test("handles a year boundary and uses the first time in a time range", () => {
  assert.deepEqual(
    parseFrenchEventDate("Du 20 décembre au 5 janvier 2027 de 10h30 à 16h", referenceDate),
    { start_at: "2026-12-20T10:30:00+01:00", end_at: "2027-01-05T10:30:00+01:00" },
  );
});

test("leaves recurring descriptions without explicit dates out of the import", () => {
  assert.equal(parseFrenchEventDate("Tous les samedis matin", referenceDate), null);
  assert.equal(parseFrenchEventDate("Le 1er vendredi du mois sauf exception", referenceDate), null);
});

test("does not turn a past year-less event into an event next year", () => {
  const events = parseTourismeDurasHtml(`<div id="enter_title1"><h3><a href="/agenda/event-past">Old market</a></h3><div>Commune : DURAS</div><div>Date : Le samedi 3 octobre</div><div>Type de manifestation : Manifestation commerciale</div><a href="/agenda/event-past">Plus d'informations ...</a></div>`, referenceDate);
  assert.equal(events.length, 0);
});

test("extracts pending events and deduplicates the same source detail URL", () => {
  const card = (id) => `<div id="enter_title${id}"><h3><a href="/agenda/event-42">Marché de Noël</a></h3><h4>Commune : DURAS</h4><div>Date : Le dimanche 13 décembre 2026 à partir de 9h</div><div>Type de manifestation : Marché</div><p>Artisans et producteurs locaux.</p><a href="/agenda/event-42">Plus d'informations ...</a></div>`;
  const events = parseTourismeDurasHtml(card(1) + card(2), referenceDate);
  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Marché de Noël");
  assert.equal(events[0].city, "DURAS");
  assert.equal(events[0].description, "Artisans et producteurs locaux.");
  assert.equal(events[0].short_description, "Artisans et producteurs locaux.");
  assert.equal(events[0].source_url, "https://www.tourismeduras.com/agenda/event-42");
  assert.equal(events[0].status, "pending");
  assert.equal(events[0].verified, false);
  assert.equal(events[0].start_at, "2026-12-13T09:00:00+01:00");
  assert.equal(events[0].source_category, "Marché");
});

test("enriches an event with practical details, external links, image and coordinates", () => {
  const event = {
    title: "Halloween au Musée des Mystères",
    slug: "halloween-au-musee-des-mysteres-2026-10-03",
    short_description: "Source summary",
    description: "Source summary",
    start_at: "2026-10-03T10:00:00+02:00",
    end_at: "2026-11-01T10:00:00+01:00",
    venue_name: null,
    address: null,
    postcode: null,
    city: "MARMANDE",
    price_from: null,
    price_to: null,
    is_free: false,
    website_url: null,
    booking_url: null,
    contact_phone: null,
    image_url: null,
    organizer_name: null,
    source_category: "Animation et fête locale",
    latitude: null,
    longitude: null,
    source_url: "https://www.tourismeduras.com/s-eclater-rencontrer/agenda-des-sorties/9040:halloween-au-musee-des-mysteres",
    status: "pending",
    verified: false,
  };
  const details = `<div id="perso_pane_57"><h2>DESCRIPTIF</h2><p>Description :</p><p>Une soirée au musée.</p><p>Date de début : 3 octobre 2026</p></div><div id="perso_pane_56"><h2>INFOS PRATIQUES</h2><p>Adresse :</p><p>Musée des Mystères</p><p>23 rue Mirabeau</p><p>47200 MARMANDE</p><p>Tel mobile :</p><p>+33 7 83 13 69 30</p><p>Tarifs : 8 € à 12 €</p><a href="mysteum.fr/">Site internet</a><a href="www-252b.bookeo.com/bookeo/start">Réserver en ligne</a><p>Organisateur : Musée des Mystères</p></div><div id="perso_pane_59"><p>Longitude : 0.1712370</p><p>Latitude : 44.5178760</p></div><img src="/images/halloween-musee-des-mysteres.jpg" alt="Halloween au Musée des Mystères">`;
  const enriched = enrichTourismeDurasEvent(event, details);
  assert.equal(enriched.venue_name, "Musée des Mystères");
  assert.equal(enriched.address, "23 rue Mirabeau");
  assert.equal(enriched.postcode, "47200");
  assert.equal(enriched.city, "MARMANDE");
  assert.equal(enriched.contact_phone, "+33 7 83 13 69 30");
  assert.equal(enriched.price_from, 8);
  assert.equal(enriched.price_to, 12);
  assert.equal(enriched.website_url, "https://mysteum.fr/");
  assert.equal(enriched.booking_url, "https://www-252b.bookeo.com/bookeo/start");
  assert.equal(enriched.image_url, "https://www.tourismeduras.com/images/halloween-musee-des-mysteres.jpg");
  assert.equal(enriched.organizer_name, "Musée des Mystères");
  assert.equal(enriched.latitude, 44.517876);
  assert.equal(enriched.longitude, 0.171237);
  assert.equal(enriched.description, "Une soirée au musée.");
});
