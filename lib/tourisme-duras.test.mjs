import test from "node:test";
import assert from "node:assert/strict";
import { parseFrenchEventDate, parseTourismeDurasHtml } from "./tourisme-duras.ts";

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
});
