import { NextRequest, NextResponse } from "next/server";
import { distanceKm, findDemoPlace } from "../../../amsterdam-demo/places";

export const revalidate = 0;

type JsonRecord = Record<string, unknown>;
type Position = { latitude: number; longitude: number };
type DemoEvent = {
  id: string; title: string; description: string; start: string; end: string;
  url: string; latitude: number; longitude: number; distanceKm: number;
  category: string; source: string;
};

const categories = ["Alle categorieën", "Markten & braderieën", "Concerten & muziek", "Theater & podium", "Festivals & evenementen", "Workshops & cursussen", "Kinderen & familie", "Sport & bewegen", "Natuur & buiten", "Kunst & tentoonstellingen", "Eten & drinken", "Film & cinema", "Overig"];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function classify(title: string, description: string): string {
  const value = `${title} ${description}`.toLocaleLowerCase("nl");
  const rules: [string, RegExp][] = [
    ["Markten & braderieën", /markt|braderie|beurs|rommelmarkt|vlooienmarkt/],
    ["Concerten & muziek", /concert|muziek|dj\b|live.?music|opera|jazz|festival.*muziek/],
    ["Theater & podium", /theater|toneel|cabaret|dansvoorstelling|podium|musical/],
    ["Festivals & evenementen", /festival|parade|evenement|manifestatie|intocht/],
    ["Workshops & cursussen", /workshop|cursus|lezing|seminar|rondleiding|masterclass/],
    ["Kinderen & familie", /kind|familie|jeugd|sinterklaas|pasen|kerstmarkt/],
    ["Sport & bewegen", /sport|wedstrijd|marathon|hardloop|voetbal|wieler|schaatsen/],
    ["Natuur & buiten", /natuur|wandeling|excursie|buiten|park|groen/],
    ["Kunst & tentoonstellingen", /kunst|expositie|tentoonstelling|museum|galerie/],
    ["Eten & drinken", /food|eten|proeverij|culinair|bier|wijn|restaurant/],
    ["Film & cinema", /film|cinema|bioscoop|documentaire/],
  ];
  return rules.find(([, pattern]) => pattern.test(value))?.[0] ?? "Overig";
}

function coordinatesFromGeometry(value: unknown, positions: number[][] = []): number[][] {
  if (!Array.isArray(value)) return positions;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    positions.push([value[0], value[1]]);
    return positions;
  }
  for (const child of value) coordinatesFromGeometry(child, positions);
  return positions;
}

// Amsterdam's API stores geometries in the Dutch national grid; GeoJSON feeds
// can also supply WGS84. This local approximation is used only for distance display.
function rdToWgs84(x: number, y: number): Position {
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return { longitude: x, latitude: y };
  const dx = (x - 155000) / 100000;
  const dy = (y - 463000) / 100000;
  const latitude = 52.1551744 + 1.00085678 * dy + 0.000034732 * dx ** 2 - 0.000000704 * dy * dx ** 2
    - 0.000000001 * dy ** 3 + 0.0000000007 * dx ** 2 * dy ** 2 - 0.0000000001 * dx ** 4;
  const longitude = 5.38720621 + 0.01118246 * dx - 0.000001 * dx * dy - 0.000000014 * dx ** 3
    + 0.000000006 * dx * dy ** 2 + 0.0000000002 * dx ** 3 * dy ** 2;
  return { latitude, longitude };
}

function featureRows(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return payload.filter((row): row is JsonRecord => Boolean(row && typeof row === "object"));
  if (!payload || typeof payload !== "object") return [];
  const root = payload as JsonRecord;
  if (Array.isArray(root.features)) return root.features.flatMap((feature) => {
    if (!feature || typeof feature !== "object") return [];
    const row = feature as JsonRecord;
    return [{ ...(row.properties as JsonRecord ?? {}), geometry: row.geometry }];
  });
  if (Array.isArray(root.results)) return root.results as JsonRecord[];
  const embedded = root._embedded as JsonRecord | undefined;
  if (embedded) {
    const rows = Object.values(embedded).find(Array.isArray);
    if (Array.isArray(rows)) return rows as JsonRecord[];
  }
  return [];
}

function eventPosition(row: JsonRecord): Position | null {
  const geometry = row.geometry as JsonRecord | undefined;
  const points = coordinatesFromGeometry(geometry?.coordinates);
  if (!points.length) return null;
  const mean = points.reduce((result, point) => [result[0] + point[0] / points.length, result[1] + point[1] / points.length], [0, 0]);
  return rdToWgs84(mean[0], mean[1]);
}

function eventDate(value: string): string {
  if (!value) return "";
  return value.slice(0, 16);
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city") ?? "Amsterdam";
  const place = findDemoPlace(city);
  const radius = Number(request.nextUrl.searchParams.get("radius") ?? 5);
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100).toLocaleLowerCase("nl");
  const category = request.nextUrl.searchParams.get("category") ?? "Alle categorieën";
  if (!place || ![5, 10, 25, 50].includes(radius) || !categories.includes(category)) {
    return NextResponse.json({ error: "Kies een geldige plaats, afstand en categorie." }, { status: 400 });
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
  const params = new URLSearchParams({ _format: "geojson", _pageSize: "500", "startdatum[gte]": today });
  // The open dataset uses the Dutch national grid (Amsterdam approximately
  // RD 121687, 487314). A local linear conversion is accurate enough to ask
  // the source for a bounded subset; exact WGS84 distance is checked again below.
  const rdX = 121687 + (place.longitude - 4.9041) * 68000;
  const rdY = 487314 + (place.latitude - 52.3676) * 111000;
  params.set("geometry[within]", `POINT(${Math.round(rdX)} ${Math.round(rdY)}),${radius * 1000}`);

  let response: Response;
  try {
    response = await fetch(`https://api.data.amsterdam.nl/v1/evenementen/v1/evenementen/?${params.toString()}`, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "De openbare evenementendata van Amsterdam is tijdelijk niet bereikbaar.", events: [], sourceStatus: "unavailable" }, { status: 503 });
  }
  if (!response.ok) {
    return NextResponse.json({ error: "De openbare evenementendata antwoordde met een fout.", events: [], sourceStatus: "unavailable" }, { status: 502 });
  }

  const payload: unknown = await response.json();
  const now = Date.now();
  const events: DemoEvent[] = featureRows(payload).flatMap((row) => {
    const title = text(row.titel ?? row.title ?? row.naam);
    const description = text(row.omschrijving ?? row.description);
    const start = text(row.startdatum ?? row.start_at ?? row.start);
    const end = text(row.einddatum ?? row.end_at ?? row.end) || start;
    const url = text(row.url ?? row.website_url);
    const position = eventPosition(row);
    if (!title || !position || !start || !Number.isFinite(new Date(end).getTime()) || new Date(end).getTime() < now) return [];
    if (query && !`${title} ${description}`.toLocaleLowerCase("nl").includes(query)) return [];
    const foundCategory = classify(title, description);
    if (category !== "Alle categorieën" && category !== foundCategory) return [];
    const distance = distanceKm(place, position);
    if (distance > radius) return [];
    return [{
      id: String(row.id ?? `${title}-${start}`), title, description, start: eventDate(start), end: eventDate(end),
      url: /^https:\/\//i.test(url) ? url : "https://activiteiten.amsterdam.nl/evenementenbureau/",
      latitude: position.latitude, longitude: position.longitude, distanceKm: Math.round(distance * 10) / 10,
      category: foundCategory, source: "Gemeente Amsterdam · Datapunt",
    }];
  }).sort((a, b) => a.start.localeCompare(b.start) || a.distanceKm - b.distanceKm);

  return NextResponse.json({ events, city, radiusKm: radius, sourceStatus: "live", updatedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "no-store, max-age=0", "X-Source": "Amsterdam Datapunt" },
  });
}
