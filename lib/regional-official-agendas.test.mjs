import test from "node:test";
import assert from "node:assert/strict";
import { fetchRegionalOfficialEventsWithReport } from "./import-sources/regional-official-agendas.ts";

const referenceDate = new Date("2026-10-23T10:00:00Z");

test("keeps original municipal detail links and parses dated Marmande and Pineuilh events", async () => {
  const originalFetch = globalThis.fetch;
  const responses = new Map([
    ["https://www.mairie-marmande.fr/evenements/", [
      '<article class="event-card"><p>Du 19 sep. au 09 jan.</p>',
      '<h2><a href="/evenements/racines-parlantes/">Exposition “Racines parlantes”</a></h2></article>',
    ].join("")],
    ["https://www.mairie-marmande.fr/evenements/racines-parlantes/", [
      '<meta property="og:image" content="/images/racines.jpg">',
      '<h1>Culture, Exposition : Exposition “Racines parlantes”</h1>',
      '<p>Du 19 sep. au 09 jan.</p><p>Publié le 28/08/2026</p>',
    ].join("")],
    ["https://www.ville-miramontdeguyenne.fr/fr/", ""],
    ["https://www.pineuilh.fr/manifestations-pineuilh-gironde", [
      '<article class="manifestation-card"><p>Du 24 Octobre 2026 au 25 Octobre 2026</p>',
      '<img src="/images/salon.jpg"><a href="/article_popup_710_1_salon_fr.html">Salon santé</a></article>',
    ].join("")],
    ["https://www.pineuilh.fr/article_popup_710_1_salon_fr.html", [
      "<h1>Salon santé</h1><p>Samedi 24 octobre : le Salon de la santé.</p>",
      '<meta name="description" content="Un rendez-vous santé à Pineuilh.">',
    ].join("")],
    ["https://www.saintefoylagrande.fr/tous-les-evenements/", ""],
  ]);

  globalThis.fetch = async (input) => {
    const url = String(input);
    const html = responses.get(url);
    if (html === undefined) throw new Error("Unexpected URL: " + url);
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  };

  try {
    const result = await fetchRegionalOfficialEventsWithReport(referenceDate);
    assert.equal(result.events.length, 2);

    const racines = result.events.find((event) => event.title.includes("Racines parlantes"));
    assert.ok(racines);
    assert.equal(racines.start_at, "2026-09-18T22:00:00.000Z");
    assert.equal(racines.end_at, "2027-01-09T22:59:00.000Z");
    assert.equal(racines.source_url, "https://www.mairie-marmande.fr/evenements/racines-parlantes/");
    assert.equal(racines.image_url, "https://www.mairie-marmande.fr/images/racines.jpg");

    const salon = result.events.find((event) => event.title === "Salon santé");
    assert.ok(salon);
    assert.equal(salon.start_at, "2026-10-23T22:00:00.000Z");
    assert.equal(salon.end_at, "2026-10-25T22:59:00.000Z");
    assert.equal(salon.source_url, "https://www.pineuilh.fr/article_popup_710_1_salon_fr.html");
    assert.equal(salon.image_url, "https://www.pineuilh.fr/images/salon.jpg");
    assert.equal(salon.status, "pending");
    assert.equal(salon.verified, false);
    assert.equal(result.sources.find((source) => source.source.includes("Marmande")).importedCandidates, 1);
    assert.equal(result.sources.find((source) => source.source.includes("Pineuilh")).importedCandidates, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not mistake a publication date for the event date", async () => {
  const originalFetch = globalThis.fetch;
  const responses = new Map([
    ["https://www.mairie-marmande.fr/evenements/", [
      '<article class="event-card"><h2><a href="/evenements/concert/">Concert au musée</a></h2></article>',
    ].join("")],
    ["https://www.mairie-marmande.fr/evenements/concert/", "<h1>Culture : Concert au musée</h1><p>Publié le 28/08/2026</p>"],
    ["https://www.ville-miramontdeguyenne.fr/fr/", ""],
    ["https://www.pineuilh.fr/manifestations-pineuilh-gironde", ""],
    ["https://www.saintefoylagrande.fr/tous-les-evenements/", ""],
  ]);
  globalThis.fetch = async (input) => {
    const url = String(input);
    const html = responses.get(url);
    if (html === undefined) throw new Error("Unexpected URL: " + url);
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  };
  try {
    const result = await fetchRegionalOfficialEventsWithReport(referenceDate);
    assert.equal(result.events.length, 0);
    assert.equal(result.sources.find((source) => source.source.includes("Marmande")).importedCandidates, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rolls a yearless event range into the next year when it crosses New Year", async () => {
  const originalFetch = globalThis.fetch;
  const responses = new Map([
    ["https://www.mairie-marmande.fr/evenements/", '<article class="event-card"><p>Du 15 décembre au 12 janvier</p><a href="/evenements/expo-hiver/">Exposition d’hiver</a></article>'],
    ["https://www.mairie-marmande.fr/evenements/expo-hiver/", "<h1>Exposition d’hiver</h1><p>Du 15 décembre au 12 janvier</p>"],
    ["https://www.ville-miramontdeguyenne.fr/fr/", ""],
    ["https://www.pineuilh.fr/manifestations-pineuilh-gironde", ""],
    ["https://www.saintefoylagrande.fr/tous-les-evenements/", ""],
  ]);
  globalThis.fetch = async (input) => {
    const html = responses.get(String(input));
    if (html === undefined) throw new Error("Unexpected URL: " + input);
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  };
  try {
    const result = await fetchRegionalOfficialEventsWithReport(referenceDate);
    const event = result.events.find((item) => item.title.includes("Exposition d’hiver"));
    assert.ok(event);
    assert.equal(event.start_at, "2026-12-14T23:00:00.000Z");
    assert.equal(event.end_at, "2027-01-12T22:59:00.000Z");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not follow an official agenda redirect to an unapproved host", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url === "https://www.mairie-marmande.fr/evenements/") {
      return new Response(null, { status: 302, headers: { location: "https://unapproved.example/events" } });
    }
    if ([
      "https://www.ville-miramontdeguyenne.fr/fr/",
      "https://www.pineuilh.fr/manifestations-pineuilh-gironde",
      "https://www.saintefoylagrande.fr/tous-les-evenements/",
    ].includes(url)) return new Response(" ", { status: 200 });
    throw new Error("Unexpected URL: " + url);
  };
  try {
    const result = await fetchRegionalOfficialEventsWithReport(referenceDate);
    assert.ok(result.sources.find((source) => source.source.includes("Marmande"))?.error);
    assert.ok(!requested.some((url) => url.includes("unapproved.example")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("imports dated municipal agenda cards that do not have a separate detail link", async () => {
  const originalFetch = globalThis.fetch;
  const listingUrl = "https://www.saintefoylagrande.fr/tous-les-evenements/";
  const responses = new Map([
    ["https://www.mairie-marmande.fr/evenements/", " "],
    ["https://www.ville-miramontdeguyenne.fr/fr/ev/735321/agenda-567", " "],
    ["https://www.pineuilh.fr/manifestations-pineuilh-gironde", " "],
    [listingUrl, '<article class="event-card"><p>31/10</p><h2>Fête de la châtaigne</h2><img src="/images/chataigne.jpg"></article>'],
  ]);
  globalThis.fetch = async (input) => {
    const html = responses.get(String(input));
    if (html === undefined) throw new Error("Unexpected URL: " + input);
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  };
  try {
    const result = await fetchRegionalOfficialEventsWithReport(referenceDate);
    const event = result.events.find((item) => item.title === "Fête de la châtaigne");
    assert.ok(event);
    assert.equal(event.start_at, "2026-10-30T23:00:00.000Z");
    assert.equal(event.source_url, listingUrl);
    assert.equal(event.image_url, "https://www.saintefoylagrande.fr/images/chataigne.jpg");
    assert.equal(event.status, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("follows numbered pages in an official agenda and reads every dated event", async () => {
  const originalFetch = globalThis.fetch;
  const pageOne = "https://www.mairie-marmande.fr/evenements/";
  const pageTwo = "https://www.mairie-marmande.fr/evenements/?page=2";
  const responses = new Map([
    [pageOne, '<article class="event-card"><p>31 oct. 2026</p><h2><a href="/evenements/concert-un/">Concert un</a></h2></article><a class="page-numbers" href="?page=2">2</a>'],
    [pageTwo, '<article class="event-card"><p>1 nov. 2026</p><h2><a href="/evenements/concert-deux/">Concert deux</a></h2></article>'],
    ["https://www.mairie-marmande.fr/evenements/concert-un/", "<h1>Concert un</h1><p>31 oct. 2026</p>"],
    ["https://www.mairie-marmande.fr/evenements/concert-deux/", "<h1>Concert deux</h1><p>1 nov. 2026</p>"],
    ["https://www.ville-miramontdeguyenne.fr/fr/ev/735321/agenda-567", " "],
    ["https://www.pineuilh.fr/manifestations-pineuilh-gironde", " "],
    ["https://www.saintefoylagrande.fr/tous-les-evenements/", " "],
  ]);
  globalThis.fetch = async (input) => {
    const html = responses.get(String(input));
    if (html === undefined) throw new Error("Unexpected URL: " + input);
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  };
  try {
    const result = await fetchRegionalOfficialEventsWithReport(referenceDate);
    const marmande = result.sources.find((source) => source.source.includes("Marmande"));
    assert.equal(marmande?.pagesRead, 2);
    assert.equal(marmande?.importedCandidates, 2);
    assert.equal(result.events.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
