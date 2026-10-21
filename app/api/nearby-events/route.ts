import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { distanceInKm, normalizePlaceName } from "../../../lib/local-area";

export const revalidate = 0;

type EventRecord = {
  id: string;
  title: string;
  slug: string;
  start_at: string;
  end_at?: string | null;
  city?: string | null;
  postcode?: string | null;
  address?: string | null;
  venue_name?: string | null;
  short_description?: string | null;
  description?: string | null;
  image_url?: string | null;
  website_url?: string | null;
  booking_url?: string | null;
  contact_phone?: string | null;
  source_url?: string | null;
  status?: string | null;
  verified?: boolean | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type CommuneFeature = {
  geometry?: { coordinates?: unknown };
  properties?: { nom?: string; codesPostaux?: string[] };
};

function isUpcoming(event: EventRecord, now: Date): boolean {
  const relevantDate = event.end_at || event.start_at;
  if (!relevantDate) return false;
  // Date-only events last through the local calendar day instead of expiring
  // at UTC midnight at the beginning of that day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(relevantDate)) {
    const todayInFrance = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    return relevantDate >= todayInFrance;
  }
  const timestamp = new Date(relevantDate).getTime();
  return Number.isFinite(timestamp) && timestamp >= now.getTime();
}

async function getCommuneCenter(city: string, postcode: string | null) {
  const params = new URLSearchParams({
    nom: city,
    fields: "nom,codesPostaux",
    format: "geojson",
    geometry: "centre",
  });
  const response = await fetch(`https://geo.api.gouv.fr/communes?${params}`, {
    next: { revalidate: 86400 },
    headers: { Accept: "application/geo+json, application/json" },
  });
  if (!response.ok) return null;

  const result = await response.json() as { features?: CommuneFeature[] };
  let matches = (result.features ?? []).filter((feature) =>
    normalizePlaceName(feature.properties?.nom ?? "") === normalizePlaceName(city)
  );
  if (postcode) {
    const matchingPostcode = matches.filter((feature) => feature.properties?.codesPostaux?.includes(postcode));
    if (matchingPostcode.length > 0) matches = matchingPostcode;
  }
  if (matches.length !== 1) return null;

  const coordinates = matches[0].geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [longitude, latitude] = coordinates;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  return { latitude, longitude };
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));
  const requestedRadius = Number(request.nextUrl.searchParams.get("radius"));
  const radiusKm = Math.min(50, Math.max(5, Number.isFinite(requestedRadius) ? requestedRadius : 25));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Kies eerst een geldige zoekplaats." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "De evenementendatabase is niet beschikbaar." }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();
  const { data, error } = await supabase
    .from("events")
    .select("id,title,slug,start_at,end_at,city,postcode,address,venue_name,short_description,description,image_url,website_url,booking_url,contact_phone,source_url,status,verified,latitude,longitude")
    .eq("status", "approved")
    .eq("verified", true)
    .order("start_at", { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ error: "Evenementen konden niet worden geladen." }, { status: 502 });

  const upcoming = ((data ?? []) as EventRecord[]).filter((event) => isUpcoming(event, now));
  const communeCenters = new Map<string, Promise<{ latitude: number; longitude: number } | null>>();
  let locationlessCount = 0;
  const results = await Promise.all(upcoming.map(async (event) => {
    let eventLatitude = event.latitude == null || event.latitude === "" ? Number.NaN : Number(event.latitude);
    let eventLongitude = event.longitude == null || event.longitude === "" ? Number.NaN : Number(event.longitude);
    let approximate = false;

    if (!Number.isFinite(eventLatitude) || !Number.isFinite(eventLongitude)
        || eventLatitude < -90 || eventLatitude > 90
        || eventLongitude < -180 || eventLongitude > 180) {
      if (!event.city) {
        locationlessCount += 1;
        return null;
      }
      const key = `${normalizePlaceName(event.city)}:${event.postcode ?? ""}`;
      if (!communeCenters.has(key)) {
        communeCenters.set(key, getCommuneCenter(event.city, event.postcode ?? null));
      }
      const center = await communeCenters.get(key);
      if (!center) {
        locationlessCount += 1;
        return null;
      }
      eventLatitude = center.latitude;
      eventLongitude = center.longitude;
      approximate = true;
    }

    const distanceKm = distanceInKm(latitude, longitude, eventLatitude, eventLongitude);
    if (distanceKm > radiusKm) return null;
    return { ...event, distance_km: Math.round(distanceKm * 10) / 10, distance_is_approximate: approximate };
  }));

  const events = results.filter((event): event is NonNullable<typeof event> => event !== null)
    .sort((a, b) => a.distance_km - b.distance_km || a.start_at.localeCompare(b.start_at));
  return NextResponse.json({ events, radius_km: radiusKm, locationless_count: locationlessCount });
}
