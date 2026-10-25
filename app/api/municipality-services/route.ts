import { NextRequest, NextResponse } from "next/server";
import { distanceInKm } from "../../../lib/local-area";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type JsonRecord = Record<string, unknown>;
type OfficialDirectoryRow = {
  nom?: string;
  plage_ouverture?: unknown;
  telephone?: unknown;
  adresse_courriel?: unknown;
  site_internet?: unknown;
  adresse?: unknown;
  annuaire?: unknown;
  information_complementaire?: string;
  affectation_personne?: unknown;
};

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const serviceTypes = new Set([
  "mairie",
  "doctor",
  "hospital",
  "library",
  "pharmacy",
  "church",
  "tourism",
  "dentist",
]);

function parseSerialized(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function valueText(value: unknown): string | undefined {
  value = parseSerialized(value);
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value)) {
    const parts = value.map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const item = part as JsonRecord;
      return [item.valeur, item.libelle].filter((entry) => typeof entry === "string" && entry.trim()).join(": ");
    }).filter(Boolean);
    return parts.length ? parts.join(" · ") : undefined;
  }
  if (value && typeof value === "object") {
    const item = value as JsonRecord;
    const parts = [item.valeur, item.libelle].filter((entry) => typeof entry === "string" && entry.trim());
    return parts.length ? parts.join(": ") : undefined;
  }
  return undefined;
}

function directoryAddress(value: unknown): string | undefined {
  value = parseSerialized(value);
  if (!Array.isArray(value)) return valueText(value);
  const address = value.find((item) => item && typeof item === "object") as JsonRecord | undefined;
  if (!address) return undefined;
  return [address.numero_voie, address.complement1, address.complement2, address.code_postal, address.nom_commune]
    .filter((part) => typeof part === "string" && part.trim())
    .join(", ") || undefined;
}

function directoryUrl(value: unknown): string | undefined {
  value = parseSerialized(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => item && typeof item === "object") as JsonRecord | undefined;
    return typeof first?.valeur === "string" ? first.valeur : undefined;
  }
  return undefined;
}

function directoryOpeningHours(value: unknown): string | undefined {
  value = parseSerialized(value);
  if (!Array.isArray(value)) return valueText(value);
  const dutchDays: Record<string, string> = {
    lundi: "maandag", mardi: "dinsdag", mercredi: "woensdag", jeudi: "donderdag",
    vendredi: "vrijdag", samedi: "zaterdag", dimanche: "zondag",
  };
  const displayTime = (part: unknown) => typeof part === "string" ? part.slice(0, 5) : "";
  const lines = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as JsonRecord;
    const start = typeof row.nom_jour_debut === "string" ? row.nom_jour_debut : "";
    const end = typeof row.nom_jour_fin === "string" ? row.nom_jour_fin : start;
    const dayName = (day: string) => dutchDays[day.toLocaleLowerCase("fr-FR")] ?? day;
    const days = start && end && start !== end ? `${dayName(start)}–${dayName(end)}` : dayName(start || end);
    const periods = [1, 2].flatMap((period) => {
      const from = displayTime(row[`valeur_heure_debut_${period}`]);
      const until = displayTime(row[`valeur_heure_fin_${period}`]);
      return from && until ? [`${from}–${until}`] : [];
    });
    const comment = typeof row.commentaire === "string" ? row.commentaire.trim() : "";
    const details = periods.length ? periods.join(", ") : comment;
    return details ? [`${days}: ${details}`] : [];
  });
  return lines.length ? lines.join(" · ") : undefined;
}

function parseMayor(value: unknown): string | undefined {
  value = parseSerialized(value);
  if (!Array.isArray(value)) return undefined;
  const assignment = value.find((item) => {
    if (!item || typeof item !== "object") return false;
    return /maire/i.test(String((item as JsonRecord).fonction ?? ""));
  }) as JsonRecord | undefined;
  if (!assignment?.personne || typeof assignment.personne !== "object") return undefined;
  const person = assignment.personne as JsonRecord;
  return [person.prenom, person.nom].filter((part) => typeof part === "string" && part.trim()).join(" ") || undefined;
}

function osmCategory(tags: Record<string, string>): string | undefined {
  const amenity = tags.amenity;
  const healthcare = tags.healthcare;
  if (amenity === "townhall") return "mairie";
  if (amenity === "hospital" || healthcare === "hospital") return "hospital";
  if (amenity === "pharmacy" || healthcare === "pharmacy") return "pharmacy";
  if (amenity === "dentist" || healthcare === "dentist") return "dentist";
  if (amenity === "doctors" || amenity === "clinic" || healthcare === "doctor" || healthcare === "clinic") return "doctor";
  if (amenity === "library") return "library";
  if (tags.tourism === "information" && ["office", "tourist_information"].includes(tags.information ?? "")) return "tourism";
  if (amenity === "place_of_worship" && /christian|catholic|protestant|orthodox/i.test(tags.religion ?? "")) return "church";
  if (tags.building === "church" || tags.building === "chapel") return "church";
  return undefined;
}

function osmAddress(tags: Record<string, string>): string | undefined {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  return [street, tags["addr:postcode"], tags["addr:city"]].filter(Boolean).join(", ") || undefined;
}

function osmDistance(lat: number, lon: number, element: OsmElement): number | undefined {
  const elementLat = element.lat ?? element.center?.lat;
  const elementLon = element.lon ?? element.center?.lon;
  if (typeof elementLat !== "number" || typeof elementLon !== "number") return undefined;
  return Math.round(distanceInKm(lat, lon, elementLat, elementLon) * 10) / 10;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const city = params.get("city")?.trim() ?? "";
  const codeInsee = params.get("codeInsee")?.trim() ?? "";
  const service = params.get("service") ?? "";
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));

  if (!city || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < 41 || latitude > 52 || longitude < -6 || longitude > 11
    || !serviceTypes.has(service)) {
    return NextResponse.json({ error: "Kies een plaats en een geldige dienst." }, { status: 400 });
  }

  const officialDirectoryPromise = codeInsee && /^\d{5}$/.test(codeInsee)
    && service === "mairie"
    ? (async () => {
      const url = new URL("https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records");
      url.searchParams.set("where", `code_insee_commune LIKE "${codeInsee}"`);
      url.searchParams.set("limit", "100");
      const response = await fetch(url, {
        next: { revalidate: 86400 },
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("De officiële gemeentelijke gegevens zijn tijdelijk niet bereikbaar.");
      const result = await response.json() as { results?: OfficialDirectoryRow[] };
      return result.results?.find((row) => /^mairie\s*-/i.test(row.nom ?? "")) ?? null;
    })()
    : Promise.resolve(null);

  // Hospitals can be farther away in this rural area; other local services use
  // a tighter radius to keep the results relevant to the selected village.
  const searchRadiusMeters = service === "hospital" ? 60000 : 25000;
  const osmFilters: Record<string, string[]> = {
    mairie: ['["amenity"="townhall"]'],
    doctor: ['["amenity"~"^(doctors|clinic)$"]', '["healthcare"~"^(doctor|clinic)$"]'],
    hospital: ['["amenity"="hospital"]', '["healthcare"="hospital"]'],
    library: ['["amenity"="library"]'],
    pharmacy: ['["amenity"="pharmacy"]', '["healthcare"="pharmacy"]'],
    church: ['["amenity"="place_of_worship"]', '["building"~"^(church|chapel)$"]'],
    tourism: ['["tourism"="information"]["information"~"^(office|tourist_information)$"]'],
    dentist: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  };
  const query = `[out:json][timeout:12];(${(osmFilters[service] ?? []).map((filter) => `nwr(around:${searchRadiusMeters},${latitude},${longitude})${filter};`).join("")});out center tags;`;
  const osmUrl = new URL("https://overpass.private.coffee/api/interpreter");
  osmUrl.searchParams.set("data", query);
  const osmLookupPromise = service === "mairie"
    ? Promise.resolve({ elements: [] as OsmElement[] })
    : fetch(osmUrl, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(14000),
      headers: { Accept: "application/json", "User-Agent": "Database47MunicipalGuide/1.0" },
    }).then(async (response) => {
      if (!response.ok) throw new Error("De kaartgegevens zijn tijdelijk niet bereikbaar.");
      return response.json() as Promise<{ elements?: OsmElement[] }>;
    });

  const [officialResult, osmResult] = await Promise.allSettled([
    officialDirectoryPromise,
    osmLookupPromise,
  ]);

  const officialRow = officialResult.status === "fulfilled" ? officialResult.value : null;
  const officialService = officialRow ? {
    id: `mairie-${codeInsee}`,
    type: "mairie",
    name: officialRow.nom ?? `Mairie - ${city}`,
    address: directoryAddress(officialRow.adresse),
    phone: valueText(officialRow.telephone),
    email: valueText(officialRow.adresse_courriel),
    website: directoryUrl(officialRow.site_internet),
    openingHours: directoryOpeningHours(officialRow.plage_ouverture),
    mayor: parseMayor(officialRow.affectation_personne),
    extra: officialRow.information_complementaire,
    sourceUrl: directoryUrl(officialRow.annuaire) ?? "https://lannuaire.service-public.gouv.fr/",
    sourceName: "Annuaire officiel Service-Public",
  } : null;

  const osmElements = osmResult.status === "fulfilled" ? osmResult.value.elements ?? [] : [];
  const services = osmElements.flatMap((element) => {
    const tags = element.tags ?? {};
    const type = osmCategory(tags);
    if (!type) return [];
    const distanceKm = osmDistance(latitude, longitude, element);
    const name = tags.name ?? tags["name:fr"];
    if (!name && type !== "mairie") return [];
    return [{
      id: `osm-${element.type}-${element.id}`,
      type,
      name: name ?? `Mairie - ${city}`,
      address: osmAddress(tags),
      phone: tags.phone ?? tags["contact:phone"],
      email: tags.email ?? tags["contact:email"],
      website: tags.website ?? tags["contact:website"],
      openingHours: tags.opening_hours,
      serviceTimes: tags.service_times,
      distanceKm,
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      sourceName: "OpenStreetMap",
    }];
  }).sort((left, right) => (left.distanceKm ?? Number.MAX_VALUE) - (right.distanceKm ?? Number.MAX_VALUE))
    .slice(0, service === "hospital" ? 5 : 16);

  if ((service === "mairie" && officialResult.status === "rejected")
    || (service !== "mairie" && osmResult.status === "rejected")) {
    return NextResponse.json({ error: "De gemeentelijke informatie is tijdelijk niet bereikbaar. Probeer het later opnieuw." }, { status: 503 });
  }

  return NextResponse.json({
    city,
    updatedAt: new Date().toISOString(),
    officialDirectoryAvailable: service === "mairie" && Boolean(codeInsee) && officialResult.status === "fulfilled",
    mapDataAvailable: service !== "mairie" && osmResult.status === "fulfilled",
    mairie: officialService,
    services,
  });
}
