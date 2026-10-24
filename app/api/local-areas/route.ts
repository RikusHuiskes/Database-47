import { NextResponse } from "next/server";
import { LOCAL_AREA_TOWNS, normalizePlaceName } from "../../../lib/local-area";

// Resolve commune coordinates at request time; cache the official API fetches
// individually so a production build does not need live network access.
export const dynamic = "force-dynamic";

type CommuneFeature = {
  geometry?: { coordinates?: unknown };
  properties?: { nom?: string; codesPostaux?: string[] };
};

export async function GET() {
  const areas = await Promise.all(LOCAL_AREA_TOWNS.map(async (town) => {
    const fallback = { ...town };
    try {
      const params = new URLSearchParams({
        nom: town.name,
        fields: "nom,codesPostaux",
        format: "geojson",
        geometry: "centre",
      });
      const response = await fetch(`https://geo.api.gouv.fr/communes?${params}`, {
        next: { revalidate: 86400 },
        headers: { Accept: "application/geo+json, application/json" },
      });
      if (!response.ok) return fallback;

      const result = await response.json() as { features?: CommuneFeature[] };
      const feature = (result.features ?? []).find((candidate) => {
        const properties = candidate.properties;
        return normalizePlaceName(properties?.nom ?? "") === normalizePlaceName(town.name)
          && (properties?.codesPostaux ?? []).includes(town.postcode);
      });
      const coordinates = feature?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return fallback;

      const [longitude, latitude] = coordinates;
      if (typeof latitude !== "number" || typeof longitude !== "number") return fallback;
      return { ...town, latitude, longitude };
    } catch {
      // Known commune-center coordinates keep search usable when the map service is unavailable.
      return fallback;
    }
  }));

  return NextResponse.json({ areas });
}
