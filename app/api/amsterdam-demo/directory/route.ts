import { NextRequest, NextResponse } from "next/server";
import { distanceKm, findDemoPlace } from "../../../amsterdam-demo/places";

export const revalidate = 0;

type Tags = Record<string, string>;
type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Tags };

const serviceTypes = [
  "Alle voorzieningen", "Gemeentehuis", "Huisarts & medisch centrum", "Ziekenhuis", "Apotheek", "Bibliotheek", "Kerk", "Tandarts", "Fysiotherapie", "Psychologische hulp", "Toeristeninformatie", "Politie", "Brandweer",
];

function mappedType(tags: Tags): string | null {
  if (tags.amenity === "townhall" || tags.office === "government") return "Gemeentehuis";
  if (tags.amenity === "hospital" || tags.healthcare === "hospital") return "Ziekenhuis";
  if (tags.amenity === "pharmacy" || tags.healthcare === "pharmacy") return "Apotheek";
  if (tags.amenity === "library") return "Bibliotheek";
  if (tags.amenity === "dentist" || tags.healthcare === "dentist") return "Tandarts";
  if (tags.healthcare === "physiotherapist" || tags.amenity === "physiotherapist") return "Fysiotherapie";
  if (["psychologist", "psychotherapist"].includes(tags.healthcare) || ["psychologist", "psychotherapist"].includes(tags.amenity)) return "Psychologische hulp";
  if (["doctors", "clinic"].includes(tags.amenity) || ["doctor", "clinic"].includes(tags.healthcare)) return "Huisarts & medisch centrum";
  if (tags.amenity === "place_of_worship" && (!tags.religion || /christian|catholic|protestant/i.test(tags.religion))) return "Kerk";
  if (tags.tourism === "information" && /office|tourist_information/i.test(tags.information ?? "")) return "Toeristeninformatie";
  if (tags.amenity === "police") return "Politie";
  if (tags.amenity === "fire_station") return "Brandweer";
  return null;
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city") ?? "Amsterdam";
  const place = findDemoPlace(city);
  const radius = Number(request.nextUrl.searchParams.get("radius") ?? 5);
  const category = request.nextUrl.searchParams.get("category") ?? "Alle voorzieningen";
  if (!place || ![5, 10, 25, 50].includes(radius) || !serviceTypes.includes(category)) {
    return NextResponse.json({ error: "Kies een geldige plaats, afstand en voorziening." }, { status: 400 });
  }

  const overpassRadius = radius * 1000;
  const query = `[out:json][timeout:25];(node(around:${overpassRadius},${place.latitude},${place.longitude})[amenity~"^(townhall|hospital|pharmacy|library|dentist|doctors|clinic|place_of_worship|police|fire_station)$"];way(around:${overpassRadius},${place.latitude},${place.longitude})[amenity~"^(townhall|hospital|pharmacy|library|dentist|doctors|clinic|place_of_worship|police|fire_station)$"];relation(around:${overpassRadius},${place.latitude},${place.longitude})[amenity~"^(townhall|hospital|pharmacy|library|dentist|doctors|clinic|place_of_worship|police|fire_station)$"];node(around:${overpassRadius},${place.latitude},${place.longitude})[healthcare~"^(doctor|clinic|hospital|pharmacy|dentist|physiotherapist|psychologist|psychotherapist)$"];way(around:${overpassRadius},${place.latitude},${place.longitude})[healthcare~"^(doctor|clinic|hospital|pharmacy|dentist|physiotherapist|psychologist|psychotherapist)$"];relation(around:${overpassRadius},${place.latitude},${place.longitude})[healthcare~"^(doctor|clinic|hospital|pharmacy|dentist|physiotherapist|psychologist|psychotherapist)$"];node(around:${overpassRadius},${place.latitude},${place.longitude})[tourism=information][information~"^(office|tourist_information)$"];way(around:${overpassRadius},${place.latitude},${place.longitude})[tourism=information][information~"^(office|tourist_information)$"];);out center tags;`;

  let payload: { elements?: Element[] };
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
      body: new URLSearchParams({ data: query }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Overpass ${response.status}`);
    payload = await response.json() as { elements?: Element[] };
  } catch {
    return NextResponse.json({ error: "De kaartbron is tijdelijk druk of niet bereikbaar. Probeer het later opnieuw.", services: [], sourceStatus: "unavailable" }, { status: 503 });
  }

  const seen = new Set<string>();
  const services = (payload.elements ?? []).flatMap((element) => {
    const tags = element.tags ?? {};
    const type = mappedType(tags);
    const name = tags.name ?? tags["name:nl"] ?? tags["name:en"];
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!type || !name || latitude == null || longitude == null || (category !== "Alle voorzieningen" && type !== category)) return [];
    const distance = distanceKm(place, { latitude, longitude, name: name });
    if (distance > radius) return [];
    const key = `${type}:${name.toLocaleLowerCase("nl")}:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: `${element.type}-${element.id}`, type, name,
      address: [tags["addr:street"] && `${tags["addr:street"]} ${tags["addr:housenumber"] ?? ""}`.trim(), tags["addr:postcode"], tags["addr:city"] ?? tags["addr:place"]].filter(Boolean).join(", "),
      municipality: tags["addr:city"] ?? tags["addr:place"] ?? city,
      phone: tags.phone ?? tags["contact:phone"], website: tags.website ?? tags["contact:website"],
      openingHours: tags.opening_hours, latitude, longitude, distanceKm: Math.round(distance * 10) / 10,
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    }];
  }).sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, "nl"));

  return NextResponse.json({ services, city, radiusKm: radius, sourceStatus: "live", updatedAt: new Date().toISOString(), emergency: { number: "112", label: "Alarmnummer politie, brandweer en ambulance", sourceUrl: "https://www.rijksoverheid.nl/onderwerpen/alarmnummer-112" } }, {
    headers: { "Cache-Control": "no-store, max-age=0", "X-Source": "OpenStreetMap Overpass" },
  });
}
