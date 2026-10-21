import { enrichTourismeDurasEvent, parseTourismeDurasHtml } from "./tourisme-duras";

export const TOURISME_DURAS_AGENDA_URL = "https://www.tourismeduras.com/s-eclater-rencontrer/agenda-des-sorties";

export async function fetchTourismeDurasEvents() {
  const response = await fetch(TOURISME_DURAS_AGENDA_URL, {
    headers: { "user-agent": "Database47-EventImporter/1.0 (+https://database-47.vercel.app)" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Tourisme Duras retourne HTTP ${response.status}.`);

  const html = await response.text();
  if (!html || html.length > 8_000_000) throw new Error("La page agenda is leeg of onverwacht groot.");

  const listedEvents = parseTourismeDurasHtml(html);
  const events = await enrichDetails(listedEvents);
  if (events.length === 0) throw new Error("Geen evenementen met een herkende datum gevonden; er is niets geïmporteerd.");
  return events;
}

async function enrichDetails(events: ReturnType<typeof parseTourismeDurasHtml>) {
  const enriched = [...events];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < events.length) {
      const index = nextIndex++;
      const event = events[index];
      try {
        const response = await fetch(event.source_url, {
          headers: { "user-agent": "Database47-EventImporter/1.0 (+https://database-47.vercel.app)" },
          signal: AbortSignal.timeout(7_000),
          cache: "no-store",
        });
        if (response.ok) enriched[index] = enrichTourismeDurasEvent(event, await response.text());
      } catch {
        // Keep listing data if an individual detail page is temporarily unavailable.
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(8, events.length) }, () => worker()));
  return enriched;
}
