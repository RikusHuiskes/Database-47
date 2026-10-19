import { NextResponse } from "next/server";
import { parseTourismeDurasHtml } from "../../../lib/tourisme-duras";

export const runtime = "nodejs";
export const revalidate = 0;

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
    const events = parseTourismeDurasHtml(html);
    if (events.length === 0) {
      return NextResponse.json({ error: "Geen evenementen met een herkende datum gevonden; er is niets geïmporteerd." }, { status: 422 });
    }
    return NextResponse.json({ events, source: AGENDA_URL });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ error: `Agenda ophalen of verwerken mislukt: ${message}` }, { status: 502 });
  }
}
