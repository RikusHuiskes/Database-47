import { NextRequest, NextResponse } from "next/server";
import { distanceInKm, normalizePlaceName } from "../../../lib/local-area";
import { CURATED_HEALTH_SERVICES } from "../../../lib/municipality-health";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type JsonRecord = Record<string, unknown>;
type OfficialDirectoryRow = {
  id?: string;
  nom?: string;
  plage_ouverture?: unknown;
  telephone?: unknown;
  adresse_courriel?: unknown;
  site_internet?: unknown;
  adresse?: unknown;
  annuaire?: unknown;
  information_complementaire?: string;
  affectation_personne?: unknown;
  id_service_local?: unknown;
  code_type_service_local?: string;
  ancien_code_pivot?: string;
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

async function resolveInseeCode(city: string, suppliedCode: string, latitude: number, longitude: number): Promise<string | undefined> {
  if (/^\d{5}$/.test(suppliedCode)) return suppliedCode;

  const aliases = normalizePlaceName(city) === normalizePlaceName("Beaumont-du-Périgord")
    ? ["Beaumontois en Périgord", city]
    : [city];
  for (const name of aliases) {
    try {
      const url = new URL("https://geo.api.gouv.fr/communes");
      url.searchParams.set("nom", name);
      url.searchParams.set("fields", "nom,code,codeDepartement");
      url.searchParams.set("format", "geojson");
      url.searchParams.set("geometry", "centre");
      const response = await fetch(url, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(2500),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const result = await response.json() as { features?: Array<{
        geometry?: { coordinates?: unknown };
        properties?: { nom?: string; code?: string; codeDepartement?: string };
      }> };
      const exactMatches = (result.features ?? []).filter((feature) => normalizePlaceName(feature.properties?.nom ?? "") === normalizePlaceName(name));
      exactMatches.sort((left, right) => {
        const coords = (feature: typeof left) => feature.geometry?.coordinates;
        const distance = (feature: typeof left) => {
          const value = coords(feature);
          if (!Array.isArray(value) || typeof value[0] !== "number" || typeof value[1] !== "number") return Number.MAX_VALUE;
          return distanceInKm(latitude, longitude, value[1], value[0]);
        };
        return distance(left) - distance(right);
      });
      const chosen = exactMatches[0] ?? (result.features ?? []).find((feature) => ["24", "33", "47"].includes(feature.properties?.codeDepartement ?? ""));
      if (/^\d{5}$/.test(chosen?.properties?.code ?? "")) return chosen!.properties!.code;
    } catch {
      // If the official geography service is temporarily unavailable, the
      // other source lookups can still provide a useful result.
    }
  }
  return undefined;
}

async function fetchOfficialRecords(where: string): Promise<OfficialDirectoryRow[]> {
  const url = new URL("https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records");
  url.searchParams.set("where", where);
  url.searchParams.set("limit", "100");
  const response = await fetch(url, {
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(4500),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("De officiële gemeentelijke gegevens zijn tijdelijk niet bereikbaar.");
  const result = await response.json() as { results?: OfficialDirectoryRow[] };
  return result.results ?? [];
}

function isMairieRecord(row: OfficialDirectoryRow): boolean {
  return /^mairie\s*-/i.test(row.nom ?? "") || /^mairie-/i.test(row.ancien_code_pivot ?? "");
}

async function fetchOfficialMairie(codeInsee: string | undefined): Promise<OfficialDirectoryRow | null> {
  if (!codeInsee) return null;

  // Direct commune lookup is the quickest path. If the directory does not
  // expose the relation in that field, follow its official competence index
  // to the local-service record ID, as described by DILA's API.
  try {
    const directRows = await fetchOfficialRecords(`code_insee_commune = "${codeInsee}"`);
    const directMairie = directRows.find(isMairieRecord);
    if (directMairie) return directMairie;
  } catch {
    // Continue with the official geographic-competence index below.
  }

  const competenceUrl = new URL("https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration-locale-competence-geographique/records");
  competenceUrl.searchParams.set("where", `code_insee_commune = "${codeInsee}" AND code_type_service_local = "mairie"`);
  competenceUrl.searchParams.set("limit", "20");
  const competenceResponse = await fetch(competenceUrl, {
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(4500),
    headers: { Accept: "application/json" },
  });
  if (!competenceResponse.ok) throw new Error("De officiële gemeentelijke gegevens zijn tijdelijk niet bereikbaar.");
  const competence = await competenceResponse.json() as { results?: OfficialDirectoryRow[] };
  const serviceIds = [...new Set((competence.results ?? []).flatMap((entry) => {
    const value = parseSerialized(entry.id_service_local);
    const values = Array.isArray(value) ? value : [value];
    return values.filter((id): id is string => typeof id === "string" && id.length > 0);
  }))].slice(0, 20);

  const rowsById = await Promise.all(serviceIds.map(async (id) => {
    const safeId = id.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    try {
      return await fetchOfficialRecords(`id = "${safeId}"`);
    } catch {
      return [] as OfficialDirectoryRow[];
    }
  }));
  return rowsById.flat().find(isMairieRecord) ?? null;
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
  const suppliedCodeInsee = params.get("codeInsee")?.trim() ?? "";
  const service = params.get("service") ?? "";
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));

  if (!city || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < 41 || latitude > 52 || longitude < -6 || longitude > 11
    || !serviceTypes.has(service)) {
    return NextResponse.json({ error: "Kies een plaats en een geldige dienst." }, { status: 400 });
  }

  const codeInsee = service === "mairie"
    ? await resolveInseeCode(city, suppliedCodeInsee, latitude, longitude)
    : suppliedCodeInsee;

  const officialDirectoryPromise = service === "mairie"
    ? fetchOfficialMairie(codeInsee)
    : Promise.resolve(null);

  // Hospitals can be farther away in this rural area; other local services use
  // a tighter radius to keep the results relevant to the selected village.
  const searchRadiusMeters = service === "hospital" ? 60000 : service === "mairie" ? 10000 : 25000;
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
  const osmLookupPromise = (async () => {
    let lastError: unknown;
    for (const endpoint of ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]) {
      const osmUrl = new URL(endpoint);
      osmUrl.searchParams.set("data", query);
      try {
        const response = await fetch(osmUrl, {
          next: { revalidate: 86400 },
          signal: AbortSignal.timeout(6500),
          headers: { Accept: "application/json", "User-Agent": "Database47MunicipalGuide/1.0" },
        });
        if (!response.ok) throw new Error("De kaartgegevens zijn tijdelijk niet bereikbaar.");
        return await response.json() as { elements?: OsmElement[] };
      } catch (cause) {
        lastError = cause;
      }
    }
    throw lastError ?? new Error("De kaartgegevens zijn tijdelijk niet bereikbaar.");
  })();

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
    mayorSourceUrl: "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1",
    mayorSourceName: "Répertoire national des élus — Ministère de l’Intérieur",
  } : null;

  const curatedServices = CURATED_HEALTH_SERVICES.flatMap((entry) => {
    if (entry.type !== service) return [];
    const distanceKm = Math.round(distanceInKm(latitude, longitude, entry.latitude, entry.longitude) * 10) / 10;
    if (distanceKm > (service === "hospital" ? 60 : 25)) return [];
    return [{
      id: entry.id,
      type: entry.type,
      name: entry.name,
      address: entry.address,
      phone: entry.phone,
      website: entry.website,
      distanceKm,
      sourceUrl: entry.sourceUrl,
      sourceName: entry.sourceName,
      secondarySourceUrl: entry.secondarySourceUrl,
      secondarySourceName: entry.secondarySourceName,
      doctolibUrl: entry.doctolibUrl,
      appointmentUrl: entry.appointmentUrl,
      extra: entry.extra,
    }];
  });

  const osmElements = osmResult.status === "fulfilled" ? osmResult.value.elements ?? [] : [];
  const osmServices = osmElements.flatMap((element) => {
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
  }).filter((candidate) => {
    if (service !== "doctor" && service !== "hospital") return true;
    const element = osmElements.find((item) => `osm-${item.type}-${item.id}` === candidate.id);
    const candidateLat = element?.lat ?? element?.center?.lat;
    const candidateLon = element?.lon ?? element?.center?.lon;
    if (typeof candidateLat !== "number" || typeof candidateLon !== "number") return true;
    return !curatedServices.some((curated) => {
      if (normalizePlaceName(curated.name) === normalizePlaceName(candidate.name)) return true;
      const curatedEntry = CURATED_HEALTH_SERVICES.find((item) => item.id === curated.id);
      return curatedEntry != null && distanceInKm(candidateLat, candidateLon, curatedEntry.latitude, curatedEntry.longitude) < 0.4;
    });
  });
  // Use the sourced health listings first; OpenStreetMap remains an additional
  // nearby source, rather than the only place these services can be found.
  const services = [...curatedServices, ...osmServices]
    .sort((left, right) => (left.distanceKm ?? Number.MAX_VALUE) - (right.distanceKm ?? Number.MAX_VALUE))
    .slice(0, service === "hospital" ? 5 : 16);

  const mairieFromMap = service === "mairie"
    ? osmServices.filter((entry) => entry.type === "mairie").sort((left, right) => (left.distanceKm ?? Number.MAX_VALUE) - (right.distanceKm ?? Number.MAX_VALUE))[0] ?? null
    : null;
  const mairie = officialService
    ? {
      ...officialService,
      secondarySourceUrl: mairieFromMap?.sourceUrl,
      secondarySourceName: mairieFromMap?.sourceName,
    }
    : mairieFromMap ? {
      ...mairieFromMap,
      mayorSourceUrl: "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1",
      mayorSourceName: "Répertoire national des élus — Ministère de l’Intérieur",
      extra: "De kaartbron vermeldt geen actuele burgemeester. Controleer de namen bij het officiële Répertoire national des élus of op de website van de gemeente.",
    } : null;

  if (service === "mairie" && officialResult.status === "rejected" && osmResult.status === "rejected") {
    return NextResponse.json({ error: "De gemeentelijke informatie is tijdelijk niet bereikbaar. Probeer het later opnieuw." }, { status: 503 });
  }

  return NextResponse.json({
    city,
    updatedAt: new Date().toISOString(),
    officialDirectoryAvailable: service === "mairie" && Boolean(officialRow),
    mapDataAvailable: osmResult.status === "fulfilled",
    curatedDataAvailable: curatedServices.length > 0,
    sources: service === "mairie" ? [
      { name: "Annuaire officiel Service-Public", url: officialService?.sourceUrl ?? "https://lannuaire.service-public.gouv.fr/" },
      { name: "Répertoire national des élus — Ministère de l’Intérieur", url: "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1" },
      { name: "Kaartgegevens van OpenStreetMap", url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(`mairie ${city}`)}` },
    ] : [],
    mairie,
    services,
  });
}
