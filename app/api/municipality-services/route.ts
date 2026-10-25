import { NextRequest, NextResponse } from "next/server";
import { distanceInKm, normalizePlaceName } from "../../../lib/local-area";
import { CURATED_HEALTH_SERVICES } from "../../../lib/municipality-health";
import { CURATED_LOCAL_SERVICES } from "../../../lib/municipality-local-services";

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

type GeoJsonBoundary = {
  type?: "Polygon" | "MultiPolygon";
  coordinates?: number[][][] | number[][][][];
};

type ReferenceSource = { name: string; url: string };
type OfficialEquipmentCount = {
  service: string;
  count: number;
  year: 2025;
  sourceUrl: string;
  sourceName: string;
  basis: string;
};

type PublicLibraryRow = {
  code_insee_commune?: string;
  nom_de_l_etablissement?: string;
  libelle_2?: string;
  adresse?: string;
  cp?: string;
  ville?: string;
  telephone?: string;
  site_internet?: string;
  amplitude_horaire?: string | number;
};

type SireneEstablishment = {
  siret?: string;
  activite_principale?: string;
  etat_administratif?: string;
  commune?: string;
  libelle_commune?: string;
  adresse?: string;
  numero_voie?: string;
  type_voie?: string;
  libelle_voie?: string;
  code_postal?: string;
  latitude?: string | number;
  longitude?: string | number;
  nom_commercial?: string;
  liste_enseignes?: string[] | null;
};

type SireneCompany = {
  nom_complet?: string;
  matching_etablissements?: SireneEstablishment[];
  siege?: SireneEstablishment;
};

type SireneSearchResponse = {
  results?: SireneCompany[];
  total_pages?: number;
};

const serviceTypes = new Set([
  "all",
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

async function fetchCommuneBoundary(codeInsee: string | undefined): Promise<GeoJsonBoundary | null> {
  if (!codeInsee) return null;
  try {
    const url = new URL(`https://geo.api.gouv.fr/communes/${encodeURIComponent(codeInsee)}`);
    url.searchParams.set("fields", "nom,code");
    url.searchParams.set("format", "geojson");
    url.searchParams.set("geometry", "contour");
    const response = await fetch(url, {
      next: { revalidate: 604800 },
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/geo+json, application/json" },
    });
    if (!response.ok) return null;
    const feature = await response.json() as { geometry?: GeoJsonBoundary };
    return feature.geometry ?? null;
  } catch {
    return null;
  }
}

function pointInRing(longitude: number, latitude: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] ?? [];
    const [xj, yj] = ring[j] ?? [];
    if (typeof xi !== "number" || typeof yi !== "number" || typeof xj !== "number" || typeof yj !== "number") continue;
    const crosses = ((yi > latitude) !== (yj > latitude))
      && longitude < ((xj - xi) * (latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInCommune(longitude: number, latitude: number, geometry: GeoJsonBoundary | null): boolean | undefined {
  if (!geometry?.coordinates) return undefined;
  const polygons: number[][][][] = geometry.type === "Polygon"
    ? [geometry.coordinates as number[][][]]
    : geometry.type === "MultiPolygon"
      ? geometry.coordinates as number[][][][]
      : [];
  if (!polygons.length) return undefined;
  return polygons.some((polygon) => {
    const [outerRing, ...holes] = polygon;
    return Boolean(outerRing && pointInRing(longitude, latitude, outerRing)
      && !holes.some((hole) => pointInRing(longitude, latitude, hole)));
  });
}

function municipalReferenceSources(service: string, city: string, codeInsee: string | undefined, latitude: number, longitude: number): ReferenceSource[] {
  const encodedCity = encodeURIComponent(city);
  const department = codeInsee?.slice(0, 2);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${service} ${city}`)}`;
  const osm = `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${service} ${city}`)}`;
  const annuaireSante = "https://annuaire.sante.fr/";
  const ameli = "https://annuairesante.ameli.fr/";

  switch (service) {
    case "mairie":
      return [
        { name: "Annuaire officiel Service-Public", url: "https://lannuaire.service-public.gouv.fr/" },
        { name: "Répertoire national des élus", url: "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1" },
        { name: "Kaartgegevens OpenStreetMap", url: osm },
      ];
    case "doctor":
      return [
        { name: "Annuaire Santé — Agence du Numérique en Santé", url: annuaireSante },
        { name: "Annuaire santé — Assurance Maladie", url: ameli },
        { name: "Doctolib", url: `https://www.doctolib.fr/medecin-generaliste/${city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` },
        { name: "Maiia", url: "https://www.maiia.com/" },
        { name: "Kaartgegevens OpenStreetMap", url: osm },
      ];
    case "dentist":
      return [
        { name: "Annuaire Santé — Agence du Numérique en Santé", url: annuaireSante },
        { name: "Annuaire santé — Assurance Maladie", url: ameli },
        { name: "Doctolib", url: `https://www.doctolib.fr/dentiste/${city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` },
        { name: "Kaartgegevens OpenStreetMap", url: osm },
      ];
    case "hospital":
      return [
        { name: "FINESS+ — officiële zorginstellingen", url: "https://www.data.gouv.fr/datasets/finess-structures-1" },
        { name: "Haute Autorité de Santé — kwaliteitsgegevens", url: "https://www.has-sante.fr/jcms/c_1725555/fr/qualite-des-hopitaux-et-des-cliniques" },
        { name: "Kaartgegevens OpenStreetMap", url: osm },
      ];
    case "library":
      return [
        { name: "Catalogue collectif de France — bibliotheekregister", url: `https://ccfr.bnf.fr/portailccfr/jsp/query_direct.jsp?query=rnbcd_menu_inst_pub&VILLE=${encodedCity}` },
        { name: "Ministerie van Cultuur — bibliotheken", url: "https://culture.data.gouv.fr/datasets/adresses-des-bibliotheques-publiques-2" },
        { name: "Kaartgegevens OpenStreetMap", url: osm },
      ];
    case "pharmacy":
      return [
        { name: "Annuaire Santé — Agence du Numérique en Santé", url: annuaireSante },
        { name: "Annuaire santé — Assurance Maladie", url: ameli },
        { name: "Kaartgegevens OpenStreetMap", url: osm },
      ];
    case "church":
      return [
        { name: "Messes.info — vieringen op basis van locatie", url: `https://messes.info/horaires/${latitude.toFixed(4)}:${longitude.toFixed(4)}` },
        ...(department === "47" ? [{ name: "Diocèse d’Agen", url: "https://diocese47.fr/" }] : []),
        ...(department === "24" ? [{ name: "Diocèse de Périgueux et Sarlat — misuren", url: "https://diocese24.fr/horaires-de-messe/" }] : []),
        ...(department === "33" ? [{ name: "Diocèse de Bordeaux", url: "https://bordeaux.catholique.fr/" }] : []),
        { name: "Kaartgegevens OpenStreetMap", url: osm },
      ];
    case "tourism":
      return [
        ...(department === "47" ? [{ name: "Toerisme Lot-et-Garonne — offices", url: "https://www.tourisme-lotetgaronne.com/pratique/offices-tourisme/" }] : []),
        ...(department === "24" ? [{ name: "Dordogne Périgord Tourisme — offices", url: "https://www.dordogne-perigord-tourisme.fr/cote-pratique/offices-tourisme-dordogne/" }] : []),
        ...(department === "33" ? [{ name: "Gironde Tourisme — offices", url: "https://www.gironde-tourisme.com/pratique/offices-de-tourisme/" }] : []),
        { name: "Kaartgegevens OpenStreetMap", url: osm },
      ];
    default:
      return [{ name: "Kaartgegevens OpenStreetMap", url: osm }, { name: "Google Maps", url: maps }];
  }
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

function overpassLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function osmDistance(lat: number, lon: number, element: OsmElement): number | undefined {
  const elementLat = element.lat ?? element.center?.lat;
  const elementLon = element.lon ?? element.center?.lon;
  if (typeof elementLat !== "number" || typeof elementLon !== "number") return undefined;
  return Math.round(distanceInKm(lat, lon, elementLat, elementLon) * 10) / 10;
}

const BPE_EQUIPMENT_TYPES: Partial<Record<string, string>> = {
  doctor: "D265",
  dentist: "D277",
  pharmacy: "D307",
  library: "F307",
};

const SIRENE_ACTIVITY_TYPES: Partial<Record<string, string>> = {
  doctor: "86.21Z",
  hospital: "86.10Z",
  dentist: "86.23Z",
  pharmacy: "47.73Z",
};

function sireneAddress(establishment: SireneEstablishment): string | undefined {
  if (establishment.adresse?.trim()) return establishment.adresse.trim();
  return [
    [establishment.numero_voie, establishment.type_voie, establishment.libelle_voie].filter(Boolean).join(" "),
    establishment.code_postal,
    establishment.libelle_commune,
  ].filter(Boolean).join(", ") || undefined;
}

async function fetchSireneHealthServices(
  city: string,
  codeInsee: string | undefined,
  service: string,
): Promise<Array<{
  id: string;
  type: string;
  name: string;
  address?: string;
  municipality: string;
  inSelectedMunicipality: boolean;
  distanceKm?: number;
  sourceUrl: string;
  sourceName: string;
}>> {
  const activityCode = SIRENE_ACTIVITY_TYPES[service];
  if (!codeInsee || !activityCode) return [];

  const fetchPage = async (page: number) => {
    const url = new URL("https://recherche-entreprises.api.gouv.fr/search");
    url.searchParams.set("q", city);
    url.searchParams.set("code_commune", codeInsee);
    url.searchParams.set("activite_principale", activityCode);
    url.searchParams.set("etat_administratif", "A");
    url.searchParams.set("limite_matching_etablissements", "100");
    url.searchParams.set("per_page", "25");
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(7000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Het officiële bedrijvenregister is tijdelijk niet bereikbaar.");
    return response.json() as Promise<SireneSearchResponse>;
  };

  try {
    const firstPage = await fetchPage(1);
    const totalPages = Math.max(1, firstPage.total_pages ?? 1);
    const remainingPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2)));
    const companies = [firstPage, ...remainingPages].flatMap((page) => page.results ?? []);
    const uniqueEstablishments = new Map<string, { company: SireneCompany; establishment: SireneEstablishment }>();

    for (const company of companies) {
      const establishments = company.matching_etablissements?.length
        ? company.matching_etablissements
        : company.siege ? [company.siege] : [];
      for (const establishment of establishments) {
        if (establishment.etat_administratif !== "A"
          || establishment.commune !== codeInsee
          || establishment.activite_principale !== activityCode
          || !establishment.siret) continue;
        uniqueEstablishments.set(establishment.siret, { company, establishment });
      }
    }

    return [...uniqueEstablishments.values()].map(({ company, establishment }) => {
      const venueName = establishment.nom_commercial?.trim()
        || establishment.liste_enseignes?.find((name) => name.trim())?.trim()
        || company.nom_complet?.trim()
        || `Zorgverlener in ${establishment.libelle_commune ?? city}`;
      return {
        id: `sirene-${establishment.siret}`,
        type: service,
        name: venueName,
        address: sireneAddress(establishment),
        municipality: establishment.libelle_commune ?? city,
        inSelectedMunicipality: true,
        sourceUrl: `https://annuaire-entreprises.data.gouv.fr/etablissement/${establishment.siret}`,
        sourceName: "Annuaire des entreprises — données Sirene",
      };
    });
  } catch {
    return [];
  }
}

function inseeCommunePage(codeInsee: string): string {
  return `https://www.insee.fr/fr/statistiques/9022155?geo=COM-${encodeURIComponent(codeInsee)}`;
}

async function fetchOfficialEquipmentCount(
  codeInsee: string | undefined,
  service: string,
): Promise<OfficialEquipmentCount | null> {
  const equipmentType = BPE_EQUIPMENT_TYPES[service];
  if (!codeInsee || !equipmentType) return null;

  try {
    const url = new URL("https://api.insee.fr/melodi/data/DS_BPE");
    url.searchParams.set("GEO", `2026-COM-${codeInsee}`);
    url.searchParams.set("TIME_PERIOD", "2025");
    url.searchParams.set("FACILITY_TYPE", equipmentType);
    url.searchParams.set("BPE_MEASURE", "FACILITIES");
    url.searchParams.set("maxResult", "10");
    const response = await fetch(url, {
      next: { revalidate: 604800 },
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const payload = await response.json() as {
      observations?: Array<{
        dimensions?: { GEO?: string; TIME_PERIOD?: string; FACILITY_TYPE?: string };
        measures?: { OBS_VALUE_NIVEAU?: { value?: number | string } };
      }>;
    };
    const observation = (payload.observations ?? []).find((item) =>
      item.dimensions?.GEO === `2026-COM-${codeInsee}`
      && item.dimensions?.TIME_PERIOD === "2025"
      && item.dimensions?.FACILITY_TYPE === equipmentType,
    );
    const rawValue = observation?.measures?.OBS_VALUE_NIVEAU?.value;
    if (rawValue == null) return null;
    const count = Number(rawValue);
    if (!Number.isFinite(count) || count < 0) return null;

    const labels: Record<string, string> = {
      doctor: "huisartspraktijken",
      dentist: "tandartspraktijken",
      pharmacy: "apotheken",
      library: "bibliotheken en andere openbare leespunten",
    };
    return {
      service,
      count,
      year: 2025,
      sourceUrl: inseeCommunePage(codeInsee),
      sourceName: "INSEE — Base permanente des équipements 2025",
      basis: `INSEE registreert ${count} ${labels[service] ?? "voorzieningen"} in deze gemeente.`,
    };
  } catch {
    return null;
  }
}

async function fetchOfficialLibraries(codeInsee: string | undefined): Promise<PublicLibraryRow[]> {
  if (!codeInsee) return [];
  try {
    const url = new URL("https://data.culture.gouv.fr/api/explore/v2.1/catalog/datasets/adresses-des-bibliotheques-publiques/records");
    url.searchParams.set("where", `code_insee_commune = "${codeInsee}"`);
    url.searchParams.set("limit", "100");
    const response = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    const result = await response.json() as { results?: PublicLibraryRow[] };
    return result.results ?? [];
  } catch {
    return [];
  }
}

function mapOfficialLibrary(row: PublicLibraryRow, city: string, index: number) {
  const weeklyHours = typeof row.amplitude_horaire === "number"
    ? `${row.amplitude_horaire} uur per week volgens het Ministerie van Cultuur`
    : typeof row.amplitude_horaire === "string" && row.amplitude_horaire.trim()
      ? `${row.amplitude_horaire} uur per week volgens het Ministerie van Cultuur`
      : undefined;
  return {
    id: `culture-library-${row.code_insee_commune ?? normalizePlaceName(city)}-${index}`,
    type: "library",
    name: row.nom_de_l_etablissement?.trim() || row.libelle_2?.trim() || `Bibliotheek in ${row.ville ?? city}`,
    address: [row.adresse?.trim(), row.cp?.trim(), row.ville?.trim()].filter(Boolean).join(", ") || undefined,
    phone: row.telephone?.trim() || undefined,
    website: row.site_internet?.trim() || undefined,
    extra: weeklyHours ? `Gepubliceerde openingsomvang: ${weeklyHours}. Dit is het totaal per week, geen dagschema.` : undefined,
    municipality: row.ville?.trim() || city,
    inSelectedMunicipality: true,
    distanceKm: undefined,
    sourceUrl: "https://data.culture.gouv.fr/explore/dataset/adresses-des-bibliotheques-publiques/",
    sourceName: "Ministère de la Culture — adresses des bibliothèques publiques",
  };
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

  const codeInsee = await resolveInseeCode(city, suppliedCodeInsee, latitude, longitude);

  const officialDirectoryPromise = service === "mairie" || service === "all"
    ? fetchOfficialMairie(codeInsee)
    : Promise.resolve(null);
  const communeBoundaryPromise = fetchCommuneBoundary(codeInsee);
  const requestedServiceTypes = service === "all"
    ? ["mairie", "doctor", "hospital", "library", "pharmacy", "church", "tourism", "dentist"]
    : [service];
  const officialCountsPromise = service === "all"
    ? Promise.all(Object.keys(BPE_EQUIPMENT_TYPES).map((type) => fetchOfficialEquipmentCount(codeInsee, type)))
    : fetchOfficialEquipmentCount(codeInsee, service).then((count) => count ? [count] : []);
  const requestedHealthTypes = (service === "all"
    ? Object.keys(SIRENE_ACTIVITY_TYPES)
    : [service]).filter((type) => SIRENE_ACTIVITY_TYPES[type]);
  const sireneServicesPromise = Promise.all(requestedHealthTypes.map((type) => fetchSireneHealthServices(city, codeInsee, type)));
  const officialLibrariesPromise = service === "library" || service === "all"
    ? fetchOfficialLibraries(codeInsee)
    : Promise.resolve([] as PublicLibraryRow[]);

  // Search nearby services as well as the chosen commune. Many villages have
  // no local GP, dentist, pharmacy or tourist office; cards keep their actual
  // municipality and distance so they are not passed off as local.
  const searchRadiusMeters: Record<string, number> = {
    mairie: 0,
    doctor: 15000,
    hospital: 60000,
    library: 20000,
    pharmacy: 15000,
    church: 15000,
    tourism: 35000,
    dentist: 15000,
  };
  const osmFilters: Record<string, string[]> = {
    mairie: ['["amenity"="townhall"]'],
    doctor: ['["amenity"~"^(doctors|clinic)$"]', '["healthcare"~"^(doctor|clinic|centre)$"]'],
    hospital: ['["amenity"="hospital"]', '["healthcare"="hospital"]'],
    library: ['["amenity"="library"]'],
    pharmacy: ['["amenity"="pharmacy"]', '["healthcare"="pharmacy"]', '["shop"="chemist"]'],
    church: ['["amenity"="place_of_worship"]', '["building"~"^(church|chapel|cathedral|basilica)$"]'],
    tourism: ['["tourism"="information"]["information"~"^(office|tourist_information)$"]'],
    dentist: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  };
  const communeSelector = [
    ...(codeInsee ? [
      `rel["boundary"="administrative"]["admin_level"="8"]["ref:INSEE"="${overpassLiteral(codeInsee)}"];`,
      `rel["boundary"="administrative"]["admin_level"="8"]["ref"="${overpassLiteral(codeInsee)}"];`,
    ] : []),
    `rel["boundary"="administrative"]["admin_level"="8"]["name"="${overpassLiteral(city)}"];`,
    `rel["boundary"="administrative"]["admin_level"="8"]["name:fr"="${overpassLiteral(city)}"];`,
  ].join(" ");
  const buildNearbyQuery = (types: string[], radiusKm?: number) => types.flatMap((type) =>
    (osmFilters[type] ?? []).map((filter) => {
      const radius = (radiusKm ?? searchRadiusMeters[type] / 1000) * 1000;
      return `nwr(around:${radius},${latitude},${longitude})${filter};`;
    }),
  ).join("");
  const osmQueries = service === "mairie"
    ? [`[out:json][timeout:15];(${communeSelector})->.selectedCommune;map_to_area .selectedCommune -> .selectedArea;(nwr(area.selectedArea)["amenity"="townhall"];);out center tags;`]
    : service === "all"
      ? [
        `[out:json][timeout:18];(${buildNearbyQuery(["doctor", "library", "pharmacy", "church", "tourism", "dentist"], 35)});out center tags;`,
        `[out:json][timeout:18];(${buildNearbyQuery(["hospital"], 60)});out center tags;`,
        `[out:json][timeout:15];(${communeSelector})->.selectedCommune;map_to_area .selectedCommune -> .selectedArea;(nwr(area.selectedArea)["amenity"="townhall"];);out center tags;`,
      ]
      : [`[out:json][timeout:15];(${buildNearbyQuery([service])});out center tags;`];
  const osmLookupPromise = Promise.allSettled(osmQueries.map(async (query) => {
    let lastError: unknown;
    for (const endpoint of ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          next: { revalidate: 86400 },
          signal: AbortSignal.timeout(endpoint.includes("private.coffee") ? 4500 : 6500),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "Database47MunicipalGuide/1.0",
          },
          body: new URLSearchParams({ data: query }),
        });
        if (!response.ok) throw new Error("De kaartgegevens zijn tijdelijk niet bereikbaar.");
        return await response.json() as { elements?: OsmElement[] };
      } catch (cause) {
        lastError = cause;
      }
    }
    throw lastError ?? new Error("De kaartgegevens zijn tijdelijk niet bereikbaar.");
  })).then((results) => {
    const successful = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    if (!successful.length) throw new Error("De kaartgegevens zijn tijdelijk niet bereikbaar.");
    const uniqueElements = new Map<string, OsmElement>();
    successful.flatMap((result) => result.elements ?? []).forEach((element) => uniqueElements.set(`${element.type}-${element.id}`, element));
    return { elements: [...uniqueElements.values()] };
  });

  const [officialResult, osmResult, boundaryResult, officialCountsResult, officialLibrariesResult, sireneServicesResult] = await Promise.allSettled([
    officialDirectoryPromise,
    osmLookupPromise,
    communeBoundaryPromise,
    officialCountsPromise,
    officialLibrariesPromise,
    sireneServicesPromise,
  ]);
  const communeBoundary = boundaryResult.status === "fulfilled" ? boundaryResult.value : null;
  const officialEquipmentCounts = officialCountsResult.status === "fulfilled"
    ? officialCountsResult.value.filter((count): count is OfficialEquipmentCount => count !== null)
    : [];
  const officialEquipmentCount = service === "all"
    ? null
    : officialEquipmentCounts[0] ?? null;
  const officialLibraryServices = officialLibrariesResult.status === "fulfilled"
    ? officialLibrariesResult.value.map((row, index) => mapOfficialLibrary(row, city, index))
    : [];
  const sireneServices = sireneServicesResult.status === "fulfilled"
    ? sireneServicesResult.value.flat()
    : [];

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
    municipality: city,
    inSelectedMunicipality: true,
    distanceKm: undefined,
    mayorSourceUrl: "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1",
    mayorSourceName: "Répertoire national des élus — Ministère de l’Intérieur",
  } : null;

  const curatedHealthServices = CURATED_HEALTH_SERVICES.flatMap((entry) => {
    if (service !== "all" && entry.type !== service) return [];
    // Keep the provider's real commune in the result and cap nearby curated
    // doctors at 15 km; this avoids showing Duras practitioners as Sainte-Foy's.
    const distanceKm = Math.round(distanceInKm(latitude, longitude, entry.latitude, entry.longitude) * 10) / 10;
    if (distanceKm > (entry.type === "hospital" ? 60 : 15)) return [];
    return [{
      id: entry.id,
      type: entry.type,
      municipality: entry.municipality,
      name: entry.name,
      address: entry.address,
      phone: entry.phone,
      website: entry.website,
      distanceKm,
      inSelectedMunicipality: normalizePlaceName(entry.municipality) === normalizePlaceName(city),
      sourceUrl: entry.sourceUrl,
      sourceName: entry.sourceName,
      secondarySourceUrl: entry.secondarySourceUrl,
      secondarySourceName: entry.secondarySourceName,
      doctolibUrl: entry.doctolibUrl,
      appointmentUrl: entry.appointmentUrl,
      extra: entry.extra,
    }];
  });

  const curatedLocalServices = CURATED_LOCAL_SERVICES.flatMap((entry) => {
    if ((service !== "all" && entry.type !== service) || normalizePlaceName(entry.municipality) !== normalizePlaceName(city)) return [];
    return [{
      id: entry.id,
      type: entry.type,
      name: entry.name,
      address: entry.address,
      phone: entry.phone,
      email: entry.email,
      website: entry.website,
      openingHours: entry.openingHours,
      serviceTimes: entry.serviceTimes,
      extra: entry.extra,
      sourceUrl: entry.sourceUrl,
      sourceName: entry.sourceName,
      secondarySourceUrl: entry.secondarySourceUrl,
      secondarySourceName: entry.secondarySourceName,
      municipality: entry.municipality,
      inSelectedMunicipality: true,
      curated: true,
      distanceKm: undefined,
    }];
  });

  const nonDuplicateOfficialLibraries = officialLibraryServices.filter((official) => !curatedLocalServices.some((local) => {
    if (local.type !== "library" || normalizePlaceName(local.municipality) !== normalizePlaceName(official.municipality ?? "")) return false;
    const officialName = normalizePlaceName(official.name);
    const localName = normalizePlaceName(local.name);
    return officialName === localName
      || officialName.includes(localName)
      || localName.includes(officialName)
      || (official.address && normalizePlaceName(official.address) === normalizePlaceName(local.address));
  }));
  const curatedServices = [
    ...(service === "all" && officialService ? [officialService] : []),
    ...curatedHealthServices,
    ...sireneServices,
    ...curatedLocalServices,
    ...nonDuplicateOfficialLibraries,
  ];

  const osmElements = osmResult.status === "fulfilled" ? osmResult.value.elements ?? [] : [];
  const osmServices = osmElements.flatMap((element) => {
    const tags = element.tags ?? {};
    const type = osmCategory(tags);
    if (!type) return [];
    if (service !== "all" && type !== service) return [];
    const distanceKm = osmDistance(latitude, longitude, element);
    if (service === "all" && type !== "mairie" && distanceKm != null && distanceKm > (searchRadiusMeters[type] ?? 0)) return [];
    const name = tags.name ?? tags["name:fr"];
    if (!name && type !== "mairie") return [];
    const elementLat = element.lat ?? element.center?.lat;
    const elementLon = element.lon ?? element.center?.lon;
    const containedByBoundary = typeof elementLat === "number" && typeof elementLon === "number"
      ? pointInCommune(elementLon, elementLat, communeBoundary)
      : undefined;
    const addressMunicipality = tags["addr:city"] ?? tags["addr:place"] ?? tags["is_in:city"];
    const inSelectedMunicipality = containedByBoundary
      ?? (addressMunicipality ? normalizePlaceName(addressMunicipality) === normalizePlaceName(city) : undefined);
    return [{
      id: `osm-${element.type}-${element.id}`,
      type,
      name: name ?? `Mairie - ${city}`,
      address: osmAddress(tags),
      phone: tags.phone ?? tags["contact:phone"],
      email: tags.email ?? tags["contact:email"],
      website: tags.website ?? tags["contact:website"],
      municipality: addressMunicipality ?? (inSelectedMunicipality ? city : undefined),
      inSelectedMunicipality,
      openingHours: tags.opening_hours,
      serviceTimes: tags.service_times,
      distanceKm,
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      sourceName: "OpenStreetMap",
    }];
  }).filter((candidate) => {
    if (!curatedServices.length) return true;
    const element = osmElements.find((item) => `osm-${item.type}-${item.id}` === candidate.id);
    const candidateLat = element?.lat ?? element?.center?.lat;
    const candidateLon = element?.lon ?? element?.center?.lon;
    return !curatedServices.some((curated) => {
      const curatedName = normalizePlaceName(curated.name);
      const candidateName = normalizePlaceName(candidate.name);
      if (curatedName === candidateName || curatedName.includes(candidateName) || candidateName.includes(curatedName)) return true;
      if (typeof candidateLat !== "number" || typeof candidateLon !== "number") return false;
      const curatedEntry = CURATED_HEALTH_SERVICES.find((item) => item.id === curated.id);
      return curatedEntry != null && distanceInKm(candidateLat, candidateLon, curatedEntry.latitude, curatedEntry.longitude) < 0.4;
    });
  });
  // Use the sourced health listings first; OpenStreetMap remains an additional
  // nearby source, rather than the only place these services can be found.
  const curatedServiceIds = new Set(curatedServices.map((entry) => entry.id));
  const mergedServices = [...curatedServices, ...osmServices]
    .sort((left, right) => {
      const leftLocal = left.inSelectedMunicipality === true;
      const rightLocal = right.inSelectedMunicipality === true;
      if (leftLocal !== rightLocal) return leftLocal ? -1 : 1;
      const leftCurated = curatedServiceIds.has(left.id);
      const rightCurated = curatedServiceIds.has(right.id);
      if (leftCurated !== rightCurated) return leftCurated ? -1 : 1;
      return (left.distanceKm ?? Number.MAX_VALUE) - (right.distanceKm ?? Number.MAX_VALUE);
    });
  const services = (service === "all" ? requestedServiceTypes : [service]).flatMap((type) =>
    mergedServices.filter((entry) => entry.type === type),
  );

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
    officialEquipmentCount,
    officialEquipmentCounts,
    mapDataAvailable: osmResult.status === "fulfilled",
    curatedDataAvailable: curatedServices.length > 0,
    sources: [
      ...new Map(requestedServiceTypes.flatMap((type) => municipalReferenceSources(type, city, codeInsee, latitude, longitude)).map((source) => [source.url, source])).values(),
      ...officialEquipmentCounts.map((count) => ({ name: count.sourceName, url: count.sourceUrl })),
      ...(sireneServices.length ? [{ name: "Annuaire des entreprises — données Sirene", url: "https://recherche-entreprises.api.gouv.fr/" }] : []),
    ],
    mairie,
    services,
  });
}
