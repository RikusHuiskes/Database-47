import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { distanceInKm, normalizePlaceName } from "../../../lib/local-area";
import { savedCommuneCenter } from "../../../lib/commune-center";
import { uniqueEventRecords, promotionIsActive } from "../../../lib/event-presentation";

export const revalidate = 0;

type EventRecord = {
  id: string;
  title: string;
  slug: string;
  start_at: string;
  is_directory_entry?: boolean;
  end_at?: string | null;
  city?: string | null;
  postcode?: string | null;
  address?: string | null;
  venue_name?: string | null;
  short_description?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_free?: boolean | null;
  website_url?: string | null;
  booking_url?: string | null;
  contact_phone?: string | null;
  source_url?: string | null;
  category_id?: string | null;
  status?: string | null;
  verified?: boolean | null;
  event_categories?: { category_id: string }[];
  latitude?: number | string | null;
  longitude?: number | string | null;
  promotion_type?: "none" | "homepage" | "category" | "highlight" | null;
  promotion_status?: "none" | "requested" | "active" | "ended" | null;
  promotion_start_at?: string | null;
  promotion_end_at?: string | null;
};

type CommuneFeature = {
  geometry?: { coordinates?: unknown };
  properties?: { nom?: string; codesPostaux?: string[] };
};

function isUpcoming(event: EventRecord, now: Date): boolean {
  if (event.is_directory_entry) return true;
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
  const saved = savedCommuneCenter(city, postcode);
  if (saved) return saved;
  const params = new URLSearchParams({
    nom: city,
    fields: "nom,codesPostaux",
    format: "geojson",
    geometry: "centre",
  });
  const response = await fetch(`https://geo.api.gouv.fr/communes?${params}`, {
    next: { revalidate: 86400 },
    headers: { Accept: "application/geo+json, application/json" },
    signal: AbortSignal.timeout(3000),
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
  const latitude = Number(request.nextUrl.searchParams.get("lat") || Number.NaN);
  const longitude = Number(request.nextUrl.searchParams.get("lon") || Number.NaN);
  const requestedRadius = Number(request.nextUrl.searchParams.get("radius") || Number.NaN);
  const radiusKm = Math.min(50, Math.max(5, Number.isFinite(requestedRadius) ? requestedRadius : 25));
  const category = request.nextUrl.searchParams.get('category');
  if(category && category!=='all' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(category)) {
    return NextResponse.json({error:'Kies een geldige categorie.'},{status:400});
  }

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
  // Fetch category links with each page, not in one additional request per 100
  // events. The inner relation restricts parent rows at the database boundary.
  const pageSize = 500;
  const rows: EventRecord[] = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("events")
      .select("id,title,slug,start_at,end_at,is_directory_entry,city,postcode,address,venue_name,short_description,description,image_url,is_free,website_url,booking_url,contact_phone,source_url,status,verified,latitude,longitude,promotion_type,promotion_status,promotion_start_at,promotion_end_at,event_categories(category_id)" + (category && category !== 'all' ? ",matching_category:event_categories!inner(category_id)" : ""))
      .eq("status", "approved")
      .eq("verified", true)
      // Latitude is a conservative coarse bound. Missing/invalid coordinates
      // still take the commune fallback; exact distance is checked below.
      .or(`and(latitude.gte.${latitude-radiusKm/110},latitude.lte.${latitude+radiusKm/110}),latitude.is.null,longitude.is.null,latitude.lt.-90,latitude.gt.90,longitude.lt.-180,longitude.gt.180`)
      .order("start_at", { ascending: true })
      .order("id");
    if (category && category !== 'all') query = query.eq("matching_category.category_id", category);
    const { data, error } = await query.range(offset, offset + pageSize - 1);

    if (error) return NextResponse.json({ error: "Evenementen konden niet worden geladen." }, { status: 502 });
    rows.push(...((data ?? []) as unknown as EventRecord[]));
    if (!data || data.length < pageSize) break;
  }
  const upcoming = uniqueEventRecords(rows).map(({event_categories, ...event}) => {
    const category_ids = (event_categories ?? []).map(link => link.category_id);
    return { ...event, start_at:event.start_at??'', category_id: category_ids[0] ?? null, category_ids };
  })
    .filter((event) => isUpcoming(event, now) && (!category || category==='all' || event.category_ids.includes(category)));
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
        communeCenters.set(key, getCommuneCenter(event.city, event.postcode ?? null).catch(() => null));
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
  const homepage_promotions = events.filter((event) => event.promotion_type === "homepage" && promotionIsActive(event, now)).slice(0, 3);
  const category_promotions = events.filter((event) => event.promotion_type === "category" && promotionIsActive(event, now));
  return NextResponse.json({ events, homepage_promotions, category_promotions, radius_km: radiusKm, locationless_count: locationlessCount });
}
