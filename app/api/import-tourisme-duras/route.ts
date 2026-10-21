import { NextResponse } from "next/server";
import { enrichTourismeDurasEvent, parseTourismeDurasHtml } from "../../../lib/tourisme-duras";

export const runtime = "nodejs";
export const revalidate = 0;
export const maxDuration = 60;

const AGENDA_URL = "https://www.tourismeduras.com/s-eclater-rencontrer/agenda-des-sorties";

export async function GET() {
  try {
    const response = await fetch(AGENDA_URL, {
      headers: { "user-agent": "Database47-EventImporter/1.0 (+https://database-47.vercel.app)" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: `Tourisme Duras retourne HTTP ${response.status}.` }, { status: 502 });
    }
    const html = await response.text();
    if (!html || html.length > 8_000_000) {
      return NextResponse.json({ error: "La page agenda is leeg of onverwacht groot." }, { status: 502 });
    }
    const listedEvents = parseTourismeDurasHtml(html);
    const events = await enrichDetails(listedEvents);
    if (events.length === 0) {
      return NextResponse.json({ error: "Geen evenementen met een herkende datum gevonden; er is niets geïmporteerd." }, { status: 422 });
    }
    return NextResponse.json({ events, source: AGENDA_URL });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ error: `Agenda ophalen of verwerken mislukt: ${message}` }, { status: 502 });
  }
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
        // Keep the listing data when a detail page is temporarily unavailable.
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(8, events.length) }, () => worker()));
  return enriched;
}
