import { NextResponse } from "next/server";
import { LOCAL_AREA_TOWNS, VISITOR_EVENT_CITY_GROUPS, distanceInKm, normalizePlaceName } from "../../../lib/local-area";

// Resolve commune coordinates at request time; cache the official API fetches
// individually so a production build does not need live network access.
export const dynamic = "force-dynamic";

type CommuneFeature = {
  geometry?: { coordinates?: unknown };
  properties?: { nom?: string; code?: string; codesPostaux?: string[] };
};

type ResolvedArea = {
  id: string;
  name: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  code_insee?: string;
  distance_group: string;
};

export async function GET() {
  const duras = LOCAL_AREA_TOWNS.find((town) => town.id === "duras")!;
  const departments = ["24", "33", "47"];
  const departmentFeatures = await Promise.all(departments.map(async (department) => {
    try {
      const params = new URLSearchParams({
        codeDepartement: department,
        fields: "nom,code,codesPostaux",
        format: "geojson",
        geometry: "centre",
      });
      const response = await fetch(`https://geo.api.gouv.fr/communes?${params}`, {
        next: { revalidate: 86400 },
        headers: { Accept: "application/geo+json, application/json" },
      });
      if (!response.ok) return [] as CommuneFeature[];

      const result = await response.json() as { features?: CommuneFeature[] };
      return result.features ?? [];
    } catch {
      return [] as CommuneFeature[];
    }
  }));

  const communes = departmentFeatures.flat();
  const requestedNames = new Set<string>(VISITOR_EVENT_CITY_GROUPS.flatMap((group) => group.cities));
  const areas: ResolvedArea[] = VISITOR_EVENT_CITY_GROUPS.flatMap((group) => group.cities.map((name) => {
    const matches = communes.filter((commune) => normalizePlaceName(commune.properties?.nom ?? "") === normalizePlaceName(name));
    const feature = matches
      .map((candidate) => {
        const coordinates = candidate.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
        const [longitude, latitude] = coordinates;
        if (typeof latitude !== "number" || typeof longitude !== "number") return null;
        return { candidate, latitude, longitude, distance: distanceInKm(duras.latitude, duras.longitude, latitude, longitude) };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((left, right) => left.distance - right.distance)[0];
    const fallback = LOCAL_AREA_TOWNS.find((town) => normalizePlaceName(town.name) === normalizePlaceName(name));

    return {
      id: normalizePlaceName(name).replace(/\s+/g, "-"),
      name,
      postcode: feature?.candidate.properties?.codesPostaux?.[0] ?? fallback?.postcode ?? "",
      latitude: feature?.latitude ?? fallback?.latitude ?? null,
      longitude: feature?.longitude ?? fallback?.longitude ?? null,
      code_insee: feature?.candidate.properties?.code ?? fallback?.code_insee,
      distance_group: group.label,
    };
  }));

  // Keep the locations that were already in the visitor dropdown, even when
  // they were not included in the newly supplied 50 km town list.
  areas.push(...LOCAL_AREA_TOWNS
    .filter((town) => !requestedNames.has(town.name))
    .map((town) => ({ ...town, distance_group: "Overige plaatsen" })));

  return NextResponse.json({ areas });
}
