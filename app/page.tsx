
"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {IMPORT_SOURCES,ALL_IMPORT_SOURCES,fetchImportPreview} from '../lib/admin-import-sources';
import FloatingPromotions from './components/FloatingPromotions';
import AdvertiserFields from "./components/AdvertiserFields";
import {emptyAdvertiser,validateAdvertiser} from "../lib/advertising";
import AnalyticsConsent from "./components/AnalyticsConsent";
import MailSettings from './components/MailSettings';
import ListingRequestForm from './components/ListingRequestForm';
import ListingRequestsAdmin from './components/ListingRequestsAdmin';
import AdvertisingRequests from "./components/AdvertisingRequests";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import {trackAnalytics} from "../lib/analytics-client";
import {upcomingHighlights,promotionPlacements,uniqueEventRecords,promotionIsActive} from "../lib/event-presentation";
import {normalizeWebAddress} from "../lib/web-address";
import {loadAdminEvents} from "../lib/admin-event-loader";
import {alphabeticalPlaces} from "../lib/place-order";
import {searchAdminEvents} from "../lib/admin-event-search";
import {approvePendingImports,isPendingImport} from "../lib/admin-bulk-approve";
import { createClient } from "@supabase/supabase-js";
import { parseFrenchEventDate, type ImportedEvent } from "../lib/tourisme-duras";
import { inferEventCategorySlug } from "../lib/import-sources";
import {prepareEventPhoto} from "../lib/event-photo-browser";
import { eventPhotoType } from "../lib/event-photo";
import { LOCAL_AREA_TOWNS, VISITOR_EVENT_CITY_GROUPS, normalizePlaceName, type LocalAreaTown } from "../lib/local-area";
type Category = {
  id: string;
  name?: string;
  slug?: string;
};

type EventRow = {
  id: string;
  title: string;
  slug: string;
  category_name?: string | null;
  category_id?: string | null;
  category_ids?: string[];
  start_at: string;
  is_directory_entry?: boolean;
  is_manual_entry?: boolean;
  end_at?: string | null;
  venue_name?: string | null;
  city?: string | null;
  status?: string;
  verified?: boolean | null;
  description?: string | null;
  short_description?: string | null;
  price_from?: number | null;
  price_to?: number | null;
  is_free?: boolean;
  address?: string | null;
  postcode?: string | null;
  website_url?: string | null;
  booking_url?: string | null;
  contact_phone?: string | null;
  image_url?: string | null;
  organizer_name?: string | null;
  source_category?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source_url?: string | null;
  promotion_type?: "none" | "homepage" | "category" | "highlight" | null;
  promotion_status?: "none" | "requested" | "active" | "ended" | null;
  promotion_start_at?:string|null;
  promotion_end_at?:string|null;
  advertiser_email?: string | null;
};

type LocalAreaOption = Omit<LocalAreaTown, "latitude" | "longitude"> & { latitude: number | null; longitude: number | null; distance_group?: string };
type NearbyEvent = EventRow & { distance_km: number; distance_is_approximate: boolean };
type MunicipalityServiceType = "all" | "mairie" | "doctor" | "hospital" | "library" | "pharmacy" | "church" | "tourism" | "emergency" | "dentist" | "supermarket" | "fuel" | "charging";
type MunicipalityServiceEntry = {
  latitude?: number;
  longitude?: number;
  id: string;
  type: string;
  municipality?: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  openingHours?: string;
  serviceTimes?: string;
  mayor?: string;
  mayorSourceUrl?: string;
  mayorSourceName?: string;
  extra?: string;
  distanceKm?: number;
  inSelectedMunicipality?: boolean;
  sourceUrl?: string;
  sourceName?: string;
  secondarySourceUrl?: string;
  secondarySourceName?: string;
  doctolibUrl?: string;
  appointmentUrl?: string;
};
type MunicipalityServiceResponse = {
  city: string;
  updatedAt: string;
  officialDirectoryAvailable: boolean;
  mapDataAvailable: boolean;
  curatedDataAvailable: boolean;
  officialEquipmentCount?: {
    count: number;
    year: number;
    sourceUrl: string;
    sourceName: string;
    basis: string;
  } | null;
  officialEquipmentCounts?: {
    service: string;
    count: number;
    year: number;
    sourceUrl: string;
    sourceName: string;
    basis: string;
  }[];
  mairie: MunicipalityServiceEntry | null;
  services: MunicipalityServiceEntry[];
  sources?: { name: string; url: string }[];
  error?: string;
};

const municipalityServiceOptions: { id: MunicipalityServiceType; label: string }[] = [
  { id: "all", label: "Alle categorieën — complete gemeentegids" },
  { id: "mairie", label: "Gemeentehuis & burgemeester" },
  { id: "doctor", label: "Huisarts / medisch centrum" },
  { id: "hospital", label: "Dichtstbijzijnde ziekenhuis" },
  { id: "library", label: "Bibliotheek" },
  { id: "pharmacy", label: "Apotheek" },
  { id: "church", label: "Kerk & mis- of diensttijden" },
  { id: "tourism", label: "Office de tourisme" },
  { id: "dentist", label: "Tandarts" },
  { id: "supermarket", label: "Supermarkten" },
  { id: "fuel", label: "Tankstations" },
  { id: "charging", label: "Laadpalen voor elektrische voertuigen" },
  { id: "emergency", label: "Noodnummers" },
];

const frenchEmergencyNumbers = [
  { number: "112", name: "Europees noodnummer", note: "Medische nood, politie of brandweer" },
  { number: "15", name: "SAMU", note: "Medische spoed" },
  { number: "17", name: "Politie / gendarmerie", note: "Directe politiehulp" },
  { number: "18", name: "Brandweer", note: "Brand, ongeval of persoon in gevaar" },
  { number: "114", name: "Urgence 114", note: "App, internet of sms voor doven en slechthorenden" },
];

type ImportPreviewEvent = ImportedEvent & { category_id: string };

const MAX_VISITOR_PHOTO_BYTES = 5 * 1024 * 1024;


type EventEditDraft = {
  category_id: string;
  title: string;
  short_description: string;
  description: string;
  start_at: string;
  end_at: string;
  venue_name: string;
  address: string;
  postcode: string;
  city: string;
  price_from: string;
  price_to: string;
  is_free: boolean;
  website_url: string;
  booking_url: string;
  source_url: string;
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: 11,
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  fontSize: 15,
  background: "white",
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
  fontSize: 14,
};

async function readApiJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`De server gaf geen antwoord terug (HTTP ${response.status}). Probeer het opnieuw; als dit blijft gebeuren moet de importserver worden nagekeken.`);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`De server gaf geen leesbaar antwoord terug (HTTP ${response.status}). Probeer het opnieuw.`);
  }
}

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function findSocialDateTime(value: string): string | null {
  const frenchDate = parseFrenchEventDate(value);
  if (frenchDate) return toLocalDateTime(frenchDate.start_at);

  const isoDate = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2].padStart(2, "0")}-${isoDate[3].padStart(2, "0")}T${(isoDate[4] ?? "10").padStart(2, "0")}:${isoDate[5] ?? "00"}`;
  }

  const numericDate = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (numericDate) {
    return `${numericDate[3]}-${numericDate[2].padStart(2, "0")}-${numericDate[1].padStart(2, "0")}T${(numericDate[4] ?? "10").padStart(2, "0")}:${numericDate[5] ?? "00"}`;
  }
  return null;
}

function parseLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day) || date.getHours() !== Number(hour) || date.getMinutes() !== Number(minute)) return null;
  return date;
}

function isSocialPostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (host === "fb.watch") return true;
    if (host === "facebook.com" || host.endsWith(".facebook.com")) {
      return /\/(?:groups\/[^/]+\/(?:posts|permalink)\/|posts\/|permalink\/|share\/p\/)/i.test(url.pathname)
        || Boolean(url.searchParams.get("story_fbid"))
        || (url.pathname === "/watch/" && Boolean(url.searchParams.get("v")));
    }
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      return /\/(?:p|reel|tv|stories)\/[^/]+/i.test(url.pathname);
    }
    return false;
  } catch {
    return false;
  }
}

function suggestedCategoryId(event: ImportedEvent, categories: Category[]): string {
  const slug = inferEventCategorySlug(event);
  return categories.find((category) => category.slug === slug)?.id ?? "";
}

function safeHttpUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function sourceLabel(value?: string | null): string {
  if (!value) return "Bron niet vermeld";
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    if (host === "eymet-dordogne.fr") return "Commune d’Eymet — agenda officiel";
    if (host === "api.neopse.com") return "Commune d’Eymet — officiële agenda-PDF";
    if (host === "pays-bergerac-tourisme.com") return "Pays de Bergerac Tourisme — agenda L’Eden d’Eymet";
    if (host === "tourismeduras.com") return "Tourisme Duras";
    if (host === "aquitaine.media.tourinsoft.eu") return "SIRTAQUI — CRT Nouvelle-Aquitaine";
    if (host === "openagenda.com") return "OpenAgenda — landelijke evenementenkalender";
    return host;
  } catch {
    return "Bron niet vermeld";
  }
}

export default function Home() {
  const [localAreas, setLocalAreas] = useState<LocalAreaOption[]>([]);
  const [municipalityAreaId, setMunicipalityAreaId] = useState("duras");
  const [municipalityServiceType, setMunicipalityServiceType] = useState<MunicipalityServiceType>("all");
  const [municipalityServiceInfo, setMunicipalityServiceInfo] = useState<MunicipalityServiceResponse | null>(null);
  const [municipalitySearchComplete, setMunicipalitySearchComplete] = useState(false);
  const [municipalityServicesLoading, setMunicipalityServicesLoading] = useState(false);
  const [municipalityServicesError, setMunicipalityServicesError] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState("duras");
  const deferredSelectedAreaId = useDeferredValue(selectedAreaId);
  const [visitorLocation, setVisitorLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const deferredVisitorLocation = useDeferredValue(visitorLocation);
  const [radiusKm, setRadiusKm] = useState(25);
  const [eventSearch, setEventSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [promotionClock,setPromotionClock]=useState(0);
  useEffect(()=>{const timer=window.setInterval(()=>setPromotionClock(Date.now()),60000);return()=>window.clearInterval(timer);},[]);
  const [freeOnly, setFreeOnly] = useState(false);
  const [visibleEventCount, setVisibleEventCount] = useState(18);
  const [nearbyEvents, setNearbyEvents] = useState<NearbyEvent[]>([]);
  const [homepagePromotions, setHomepagePromotions] = useState<EventRow[]>([]);
  const [categoryPromotions, setCategoryPromotions] = useState<EventRow[]>([]);
  const [selectedVisitorEvent, setSelectedVisitorEvent] = useState<EventRow | null>(null);
  const [visitorEventPlacement, setVisitorEventPlacement] = useState("standard");
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [nearbyError, setNearbyError] = useState("");
  const [locationlessCount, setLocationlessCount] = useState(0);
  const [submissionNotice, setSubmissionNotice] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editError, setEditError] = useState("");
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const [adminEventFilter, setAdminEventFilter] = useState<"pending" | "all">("pending");
  const [adminEventPage, setAdminEventPage] = useState(1);
  const [bulkApproving,setBulkApproving]=useState(false);
  const [bulkApprovalNotice,setBulkApprovalNotice]=useState('');
  const [adminEventSearch,setAdminEventSearch]=useState('');
  const [adminCategoryFilter,setAdminCategoryFilter]=useState('all');
  const [adminContentMounted, setAdminContentMounted] = useState(false);
  const [editDraft, setEditDraft] = useState<EventEditDraft | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [visitorPhoto, setVisitorPhoto] = useState<File | null>(null);
  const [visitorPhotoPreview, setVisitorPhotoPreview] = useState("");
  const visitorPhotoInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [activeImport,setActiveImport]=useState<string|null>(null);
  const importBusy=useRef(false);
  const [refreshing,setRefreshing]=useState(false);
  const refreshBusy=useRef(false);
  const [dataRevision,setDataRevision]=useState(0);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewEvent[]>([]);
  const [importPreviewLimit, setImportPreviewLimit] = useState(60);
  const [importNotice, setImportNotice] = useState("");
  const [importSourceName, setImportSourceName] = useState("");
  const [showSocialPostForm, setShowSocialPostForm] = useState(false);
  const [socialPostUrl, setSocialPostUrl] = useState("");
  const [socialPostText, setSocialPostText] = useState("");
  const [socialPostTitle, setSocialPostTitle] = useState("");
  const [socialPostStartAt, setSocialPostStartAt] = useState("");
  const [socialPostEndAt, setSocialPostEndAt] = useState("");
  const [socialPostCity, setSocialPostCity] = useState("");
  const [socialPostVenue, setSocialPostVenue] = useState("");
  const [socialPostImageUrl, setSocialPostImageUrl] = useState("");
  const [socialPostCategoryId, setSocialPostCategoryId] = useState("");
  const [socialPostError, setSocialPostError] = useState("");

  useEffect(() => {
    if (!selectedVisitorEvent) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeVisitorEvent();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [selectedVisitorEvent]);

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [cityChoice, setCityChoice] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("https://");
  const [bookingUrl, setBookingUrl] = useState("https://");
  const [sourceUrl, setSourceUrl] = useState("https://");
  const [categoryId, setCategoryId] = useState("");
  const [promotionType, setPromotionType] = useState<"none" | "homepage" | "category" | "highlight">("none");
  const [advertiser,setAdvertiser] = useState({...emptyAdvertiser});
  const [managementLink,setManagementLink] = useState("");
  const [entryKind,setEntryKind] = useState("event");

  const [supabase] = useState(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) return null;
    return createClient(url, key);
  });

  const requestedCityNames = useMemo(
    () => new Set<string>(VISITOR_EVENT_CITY_GROUPS.flatMap((group) => group.cities)),
    []
  );
  const areaOptions = useMemo<LocalAreaOption[]>(() => [
    ...VISITOR_EVENT_CITY_GROUPS.flatMap((group) => group.cities.map((name) => {
      const normalizedName = normalizePlaceName(name);
      const resolved = localAreas.find((area) => normalizePlaceName(area.name) === normalizedName);
      if (resolved) return resolved;
      const fallback = LOCAL_AREA_TOWNS.find((area) => normalizePlaceName(area.name) === normalizedName);
      return fallback
        ? { ...fallback, distance_group: group.label }
        : { id: normalizedName.replace(/\s+/g, "-"), name, postcode: "", latitude: null, longitude: null, distance_group: group.label };
    })),
    ...(localAreas.length > 0
      ? localAreas.filter((area) => !requestedCityNames.has(area.name))
      : LOCAL_AREA_TOWNS.filter((area) => !requestedCityNames.has(area.name))),
  ], [localAreas, requestedCityNames]);
  const areaOptionsByName = useMemo(
    () => new Map(areaOptions.map((area) => [normalizePlaceName(area.name), area])),
    [areaOptions]
  );
  const otherAreaOptions = useMemo(
    () => areaOptions.filter((area) => !requestedCityNames.has(area.name)),
    [areaOptions, requestedCityNames]
  );

  function renderAreaOptions() {
    return alphabeticalPlaces(areaOptions).map(area => <option key={area.id} value={area.id} disabled={area.latitude == null || area.longitude == null}>{area.name}</option>);
  }

  function openVisitorEvent(event: EventRow, placement = "standard") {
    setVisitorEventPlacement(placement);
    const route = `#activiteit/${encodeURIComponent(event.id)}`;
    window.history.pushState({ visitorEventId: event.id }, "", route);
    setSelectedVisitorEvent(event);
  }

  function closeVisitorEvent() {
    if (window.location.hash.startsWith("#activiteit/")) window.history.back();
    setSelectedVisitorEvent(null);
    window.requestAnimationFrame(() => document.getElementById("agenda")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  useEffect(() => {
    const followEventHistory = () => {
      const eventRoute = window.location.hash.match(/^#activiteit\/(.+)$/);
      if (eventRoute) {
        const slug = decodeURIComponent(eventRoute[1]);
        const event = [...nearbyEvents, ...homepagePromotions, ...categoryPromotions].find((candidate) => candidate.id === slug);
        if (event) setSelectedVisitorEvent(event);
        return;
      }
      if (selectedVisitorEvent) {
        setSelectedVisitorEvent(null);
        window.requestAnimationFrame(() => document.getElementById("agenda")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    };
    followEventHistory();
    window.addEventListener("popstate", followEventHistory);
    return () => window.removeEventListener("popstate", followEventHistory);
  }, [nearbyEvents, homepagePromotions, categoryPromotions, selectedVisitorEvent]);

  useEffect(() => {
    if (!visitorPhoto) {
      setVisitorPhotoPreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(visitorPhoto);
    setVisitorPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [visitorPhoto]);

  useEffect(() => {
    if (!editPhotoFile) {
      setEditPhotoPreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(editPhotoFile);
    setEditPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [editPhotoFile]);

  useEffect(() => {
    let active = true;
    void fetch("/api/local-areas")
      .then(async (response) => {
        if (!response.ok) throw new Error("Plaatsen konden niet worden geladen.");
        return readApiJson<{ areas?: LocalAreaOption[]; error?: string }>(response);
      })
      .then((result) => {
        if (active) setLocalAreas((result.areas ?? []) as LocalAreaOption[]);
      })
      .catch((cause) => {
        if (active) setNearbyError(cause instanceof Error ? cause.message : "Plaatsen konden niet worden geladen.");
      });
    return () => { active = false; };
  }, []);

  const selectedArea = areaOptions.find((area) => area.id === selectedAreaId);
  useEffect(()=>{
    const measure=()=>{if(selectedVisitorEvent)trackAnalytics('event_view',{eventId:selectedVisitorEvent.id,placement:visitorEventPlacement});};
    measure();window.addEventListener('analytics-ready',measure);return()=>window.removeEventListener('analytics-ready',measure);
  },[selectedVisitorEvent?.id,visitorEventPlacement]);
  useEffect(()=>{
    const measure=()=>{if(categoryFilter!=="all")trackAnalytics('category_view',{categoryId:categoryFilter});if(selectedArea&&!visitorLocation)trackAnalytics('place_view',{area:selectedArea.name});};
    measure();window.addEventListener('analytics-ready',measure);return()=>window.removeEventListener('analytics-ready',measure);
  },[categoryFilter,selectedArea?.name,visitorLocation]);
  useEffect(()=>{
    const measure=()=>trackAnalytics('filter_view',{radius:String(radiusKm),categoryId:categoryFilter==='all'?undefined:categoryFilter,area:visitorLocation?undefined:selectedArea?.name});
    measure();window.addEventListener('analytics-ready',measure);return()=>window.removeEventListener('analytics-ready',measure);
  },[categoryFilter,selectedArea?.name,visitorLocation,radiusKm]);
  const searchArea = areaOptions.find((area) => area.id === deferredSelectedAreaId);
  const searchLatitude = deferredVisitorLocation?.latitude ?? searchArea?.latitude ?? null;
  const searchLongitude = deferredVisitorLocation?.longitude ?? searchArea?.longitude ?? null;
  const searchLabel = deferredVisitorLocation ? "jouw locatie" : searchArea?.name ?? "Duras";
  const visibleNearbyEvents = useMemo(() => {
    const query = eventSearch.trim().toLocaleLowerCase("nl-NL");
    return uniqueEventRecords(nearbyEvents).map(event=>({...event,promotion_status:event.promotion_status==='active'&&!promotionIsActive(event)?'none' as const:event.promotion_status})).filter((event) => {
    const matchesSearch = !query || [event.title, event.city, event.venue_name, event.short_description, event.description]
      .some((value) => value?.toLocaleLowerCase("nl-NL").includes(query));
    const matchesCategory = categoryFilter === "all" || event.category_ids?.includes(categoryFilter) === true;
    return matchesSearch && matchesCategory && (!freeOnly || event.is_free === true);
    }).sort((left, right) => {
    const isCategoryPromotion = (event: NearbyEvent) => categoryFilter !== "all"
      && event.category_ids?.includes(categoryFilter)
      && event.promotion_type === "category"
      && event.promotion_status === "active";
    return Number(isCategoryPromotion(right)) - Number(isCategoryPromotion(left));
    });
  }, [nearbyEvents, eventSearch, categoryFilter, freeOnly,promotionClock]);
  const placements = useMemo(() => promotionPlacements(visibleNearbyEvents, categoryFilter), [visibleNearbyEvents, categoryFilter]);
  const categoryPromotionEvents = placements.category;
  const categoryPromotionIds = useMemo(() => new Set(categoryPromotionEvents.map((event) => event.id)), [categoryPromotionEvents]);
  const standardNearbyEvents = useMemo(
    () => visibleNearbyEvents.filter((event) => !categoryPromotionIds.has(event.id)),
    [visibleNearbyEvents, categoryPromotionIds]
  );
  const displayedNearbyEvents = useMemo(
    () => standardNearbyEvents.slice(0, visibleEventCount),
    [standardNearbyEvents, visibleEventCount]
  );

  useEffect(() => {
    setVisibleEventCount(18);
  }, [selectedAreaId, visitorLocation, radiusKm, eventSearch, categoryFilter, freeOnly, nearbyEvents]);

  useEffect(() => {
    if (searchLatitude == null || searchLongitude == null) {
      if (localAreas.length > 0) {
        setNearbyLoading(false);
        setNearbyError("De gekozen plaats heeft geen bruikbare locatiegegevens.");
      }
      return;
    }

    let active = true;
    const controller = new AbortController();
    setNearbyLoading(true);
    setNearbyError("");
    const params = new URLSearchParams({
      lat: String(searchLatitude),
      lon: String(searchLongitude),
      radius: String(radiusKm),
      category: categoryFilter,
    });
    void fetch(`/api/nearby-events?${params}`, {signal: controller.signal})
      .then(async (response) => {
        const result = await readApiJson<{ events?: NearbyEvent[]; homepage_promotions?: EventRow[]; category_promotions?: EventRow[]; error?: string; locationless_count?: number }>(response);
        if (!response.ok) throw new Error(result.error ?? "Evenementen konden niet worden geladen.");
        return result;
      })
      .then((result) => {
        if (!active) return;
        setNearbyEvents(result.events ?? []);
        setHomepagePromotions(result.homepage_promotions ?? []);
        setCategoryPromotions(result.category_promotions ?? []);
        setLocationlessCount(Number(result.locationless_count ?? 0));
      })
      .catch((cause) => {
        if (active) setNearbyError(cause instanceof Error ? cause.message : "Evenementen konden niet worden geladen.");
      })
      .finally(() => { if (active) setNearbyLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [localAreas.length, searchLatitude, searchLongitude, radiusKm,categoryFilter,dataRevision]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setNearbyError("Deze browser kan je locatie niet bepalen. Kies een plaats uit de lijst.");
      return;
    }
    setNearbyError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setVisitorLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => setNearbyError("Je locatie is niet gedeeld. Kies een plaats uit de lijst of probeer het opnieuw."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  function selectArea(areaId: string) {
    setVisitorLocation(null);
    setSelectedAreaId(areaId);
    setRadiusKm(["agen", "bergerac"].includes(areaId) ? 10 : 25);
  }

  async function findMunicipalityServices(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const area = areaOptions.find((candidate) => candidate.id === municipalityAreaId);
    setMunicipalityServicesError("");
    setMunicipalityServiceInfo(null);
    setMunicipalitySearchComplete(true);
    if (municipalityServiceType === "emergency") return;
    if (!area || area.latitude == null || area.longitude == null) {
      setMunicipalityServicesError("De gekozen plaats heeft nog geen kaartcoördinaten.");
      return;
    }

    setMunicipalityServicesLoading(true);
    try {
      const params = new URLSearchParams({
        city: area.name,
        lat: String(area.latitude),
        lon: String(area.longitude),
        service: municipalityServiceType,
      });
      if (area.code_insee) params.set("codeInsee", area.code_insee);
      const response = await fetch(`/api/municipality-services?${params.toString()}`, { cache: "no-store" });
      const result = await readApiJson<MunicipalityServiceResponse>(response);
      if (!response.ok) throw new Error(result.error ?? "De gegevens konden niet worden opgehaald.");
      setMunicipalityServiceInfo(result);
    } catch (cause) {
      setMunicipalityServicesError(cause instanceof Error ? cause.message : "De gemeentelijke informatie kon niet worden opgehaald.");
    } finally {
      setMunicipalityServicesLoading(false);
    }
  }

  async function loadData(includeEvents = isAdmin) {
    if (!supabase) {
      setError("Supabase-instellingen ontbreken. Controleer Vercel.");
      setLoading(false);
      return;
    }

    setError("");

    const readAllEvents = async () => {
      if (!includeEvents) return {data: [] as (EventRow & {event_categories?: {category_id:string}[]})[], error: null};
      const result = await loadAdminEvents(supabase);
      return {...result, data: ((result.data ?? []) as (EventRow & {event_categories?: {category_id:string}[]})[]).map(event => ({...event, start_at: event.start_at ?? ''}))};
    };
    const [categoryResult, eventResult] = await Promise.all([
      supabase.from("categories").select("*").order("name").limit(100),
      readAllEvents(),
    ]);

    if (categoryResult.error) {
      setError("Categorieën laden mislukt: " + categoryResult.error.message);
    } else {
      setCategories((categoryResult.data ?? []) as Category[]);
    }

    if (eventResult.error) {
      setError((previous) =>
        previous
          ? previous + " | Evenementen: " + eventResult.error.message
          : "Evenementen laden mislukt: " + eventResult.error.message
      );
    } else {
      const categoryById = new Map(((categoryResult.data ?? []) as Category[]).map(category => [category.id, category]));
      const eventsWithCategories = (eventResult.data ?? []).map(({event_categories, ...event}) => {
        const category_ids = (event_categories ?? []).map(link => link.category_id);
        const category = categoryById.get(category_ids[0]);
        return {...event, category_id: category_ids[0] ?? null, category_ids, category_name: category?.name ?? category?.slug ?? null};
      });

      setEvents(eventsWithCategories);
    }

    setLoading(false);
    return !categoryResult.error&&!eventResult.error;
  }

  async function refreshStoredData() {
    if(refreshBusy.current)return;
    refreshBusy.current=true;setRefreshing(true);setMessage('Opgeslagen gegevens worden opnieuw geladen…');
    try { const ok=await loadData(isAdmin);if(!ok){setMessage('');return;}setDataRevision(value=>value+1);setMessage('Opgeslagen gegevens vernieuwd om '+new Date().toLocaleTimeString('nl-NL')+'. Externe imports zijn niet gestart.'); }
    catch(cause){setError(cause instanceof Error?cause.message:'Vernieuwen mislukt. Probeer opnieuw.');setMessage('');}
    finally{refreshBusy.current=false;setRefreshing(false);}
  }

  async function removeExpiredEvents() {
    if (!supabase) return null;
    const { data: deletedCount, error: cleanupError } = await supabase.rpc("delete_expired_events");
    if (cleanupError) {
      setError("Verlopen evenementen opruimen mislukt: " + cleanupError.message);
      return null;
    }
    const count = typeof deletedCount === "number" ? deletedCount : 0;
    setMessage(count > 0
      ? `${count} verlopen evenement${count === 1 ? "" : "en"} automatisch verwijderd.`
      : "Controle voltooid: geen verlopen evenementen gevonden.");
    return count;
  }

  useEffect(() => {
    if (!supabase) {
      setError("Supabase-instellingen ontbreken. Controleer Vercel.");
      setLoading(false);
      setAuthLoading(false);
      return;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ? { email: session.user.email } : null);
      if (!session) {
        setIsAdmin(false);
        setEditingEventId(null);
        setEditDraft(null);
        setEvents([]);
        setLoading(false);
      }
    });

    void supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError("Sessie controleren mislukt: " + sessionError.message);
      setUser(data.session?.user ? { email: data.session.user.email } : null);
      let confirmedAdmin = false;
      if (data.session) {
        const { data: adminStatus, error: adminError } = await supabase.rpc("is_admin");
        confirmedAdmin = !adminError && adminStatus === true;
        if (active) setIsAdmin(confirmedAdmin);
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
      await loadData(confirmedAdmin);
      if (confirmedAdmin && active) {
        const deletedCount = await removeExpiredEvents();
        if (deletedCount && deletedCount > 0) await loadData(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !isAdmin) return;
    const timer = window.setInterval(async () => {
      const { data: deletedCount, error: cleanupError } = await supabase.rpc("delete_expired_events");
      if (cleanupError) {
        setError("Verlopen evenementen opruimen mislukt: " + cleanupError.message);
        return;
      }
      if (typeof deletedCount === "number" && deletedCount > 0) {
        setMessage(`${deletedCount} verlopen evenement${deletedCount === 1 ? "" : "en"} automatisch verwijderd.`);
        await loadData();
      }
    }, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, supabase]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!supabase) {
      setError("Geen Supabase-verbinding.");
      return;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail.trim(),
      password,
    });

    if (signInError) {
      setError("Inloggen mislukt: " + signInError.message);
      return;
    }

    setUser(data.user ? { email: data.user.email } : null);
    setPassword("");
    const { data: adminStatus, error: adminError } = await supabase.rpc("is_admin");
    const confirmedAdmin = !adminError && adminStatus === true;
    setIsAdmin(confirmedAdmin);
    await loadData(confirmedAdmin);
    if (confirmedAdmin) {
      const deletedCount = await removeExpiredEvents();
      if (deletedCount && deletedCount > 0) await loadData(true);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError("Uitloggen mislukt: " + signOutError.message);
    else {
      setUser(null);
      setIsAdmin(false);
      setEvents([]);
      setEditingEventId(null);
      setEditDraft(null);
    }
  }

  async function approveAllImports() {
    if(!supabase||!isAdmin||bulkApproving||importing||updatingEventId)return;
    const candidates=events.filter(isPendingImport);
    if(!candidates.length)return;
    if(!window.confirm(`Alle ${candidates.length} wachtende imports goedkeuren? Ze worden openbaar zichtbaar. Dit geldt voor alle categorieën en alle pagina’s, ook buiten je zoekfilters. Handmatige inzendingen worden niet meegenomen.`))return;
    setBulkApproving(true);setError('');setMessage('Imports goedkeuren…');setBulkApprovalNotice('Imports goedkeuren…');
    let approved=0;
    try{
      const result=await approvePendingImports(supabase,candidates,progress=>{
        approved=progress.approved;
        setBulkApprovalNotice(`${progress.processed} van ${progress.total} imports verwerkt; ${approved} goedgekeurd. Houd deze pagina open totdat de actie klaar is.`);
        setMessage(`${progress.processed} van ${progress.total} imports verwerkt; ${approved} goedgekeurd. Houd deze pagina open totdat de actie klaar is.`);
      });
      await loadData();
      setBulkApprovalNotice(`${result.approved} imports goedgekeurd.${result.skipped?` ${result.skipped} inmiddels gewijzigde of niet-toegankelijke vermeldingen overgeslagen.`:''}`);
      setMessage(`${result.approved} imports goedgekeurd en openbaar zichtbaar.${result.skipped?` ${result.skipped} al gewijzigde of niet-toegankelijke vermeldingen overgeslagen.`:''}`);
      setAdminEventPage(1);
    }catch(cause){
      await loadData();
      setBulkApprovalNotice(`Actie gestopt; ${approved} goedkeuringen bevestigd. Start opnieuw voor de resterende wachtende imports.`);
      setError(`${approved} imports goedgekeurd. De actie is gestopt: ${cause instanceof Error?cause.message:'Verbindingsfout'}. Je kunt opnieuw starten voor de resterende wachtende imports.`);
    }finally{setBulkApproving(false);}
  }

  async function setEventStatus(event: EventRow, status: "approved" | "rejected") {
    if (!supabase) {
      setError("Geen Supabase-verbinding.");
      return;
    }

    setError("");
    setMessage("");
    setUpdatingEventId(event.id);

    const { data, error: updateError } = await supabase
      .from("events")
      .update({ status, verified: status === "approved" })
      .eq("id", event.id)
      .select("id,promotion_status")
      .maybeSingle();

    if (updateError) {
      setError("Wijzigen mislukt: " + updateError.message);
      setUpdatingEventId(null);
      return;
    }

    if (!data) {
      setError("Er is niets gewijzigd. Controleer of je als beheerder bent ingelogd.");
      setUpdatingEventId(null);
      return;
    }

    setEvents(current => current.map(item => item.id === event.id ? {...item, status, verified: status === "approved",promotion_status:data.promotion_status} : item));
    setMessage(
      status === "approved"
        ? `“${event.title}” is goedgekeurd.`
        : `“${event.title}” is afgewezen.`
    );
    setUpdatingEventId(null);
  }

  async function setPromotionStatus(event: EventRow, status: "active" | "ended") {
    if (!supabase || !isAdmin || !event.promotion_type || event.promotion_type === "none") return;
    if (status === "active" && (event.status !== "approved" || event.verified !== true)) {
      setError(`“${event.title}” moet eerst worden goedgekeurd voordat de promotie kan starten.`);
      return;
    }
    setError("");
    setMessage("");
    setUpdatingEventId(event.id);
    const { data, error: updateError } = await supabase
      .from("events")
      .update({ promotion_status: status })
      .eq("id", event.id)
      .select("id")
      .maybeSingle();
    if (updateError) {
      setError(`De promotie van “${event.title}” kon niet worden aangepast: ${updateError.message}`);
      setUpdatingEventId(null);
      return;
    }
    if (!data) {
      setError(`De promotie van “${event.title}” is niet gewijzigd. Controleer de beheerdersrechten.`);
      setUpdatingEventId(null);
      return;
    }
    setEvents(current => current.map(item => item.id === event.id ? {...item, promotion_status: status} : item));
    setMessage(status === "active"
      ? `De betaalde promotie van “${event.title}” is geactiveerd.`
      : `De promotie van “${event.title}” is gestopt.`);
    setUpdatingEventId(null);
  }

  async function createOwnerLink(event:EventRow) {
    if(!supabase||!isAdmin)return;setError('');
    try { const session=await supabase.auth.getSession();const response=await fetch('/api/admin/event-access',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.data.session?.access_token},body:JSON.stringify({eventId:event.id})});const data=await response.json();if(!response.ok)throw Error(data.error);setManagementLink(window.location.origin+'/mijn-vermelding#'+data.manageFragment);setMessage('Persoonlijke beheerlink gemaakt. Geef deze uitsluitend aan de geverifieerde inzender.');}
    catch(cause){setError(cause instanceof Error?cause.message:'Beheerlink maken mislukt.');}
  }

  async function deleteEvent(event: EventRow) {
    if (!supabase || !isAdmin) {
      setError("Log in als beheerder om een evenement te verwijderen.");
      return;
    }
    if (!window.confirm(`Weet je zeker dat je “${event.title}” definitief wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;

    setError("");
    setMessage("");
    setUpdatingEventId(event.id);
    const { data, error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", event.id)
      .select("id")
      .maybeSingle();
    setUpdatingEventId(null);

    if (deleteError) {
      setError(`Verwijderen van “${event.title}” is mislukt: ${deleteError.message}`);
      return;
    }
    if (!data) {
      setError(`“${event.title}” is niet verwijderd. Controleer of je als beheerder bent ingelogd.`);
      return;
    }

    setEvents((current) => current.filter((item) => item.id !== event.id));
    if (editingEventId === event.id) {
      setEditingEventId(null);
      setEditDraft(null);
    }
    setMessage(`“${event.title}” is verwijderd.`);
  }

  function beginEdit(event: EventRow) {
    setError("");
    setMessage("");
    setEditError("");
    setSavedEventId(null);
    setEditingEventId(event.id);
    setEditPhotoFile(null);
    setEditDraft({
      category_id: event.category_id ?? "",
      title: event.title ?? "",
      short_description: event.short_description ?? "",
      description: event.description ?? "",
      start_at: toLocalDateTime(event.start_at),
      end_at: toLocalDateTime(event.end_at),
      venue_name: event.venue_name ?? "",
      address: event.address ?? "",
      postcode: event.postcode ?? "",
      city: event.city ?? "",
      price_from: event.price_from == null ? "" : String(event.price_from),
      price_to: event.price_to == null ? "" : String(event.price_to),
      is_free: Boolean(event.is_free),
      website_url: event.website_url ?? "",
      booking_url: event.booking_url ?? "",
      source_url: event.source_url ?? "",
    });
  }

  function updateEditDraft(field: keyof EventEditDraft, value: string | boolean) {
    setEditDraft((current) =>
      current ? ({ ...current, [field]: value } as EventEditDraft) : current
    );
  }

  async function persistEventCategory(eventId: string, categoryId: string) {
    if (!supabase) return "Geen Supabase-verbinding.";
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return `Beheerdersessie controleren mislukt: ${sessionError.message}`;
    if (!session?.access_token) return "Je beheerdersessie is verlopen. Log opnieuw in.";

    let response: Response;
    try {
      response = await fetch("/api/admin/event-category", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId, categoryId: categoryId || null }),
      });
    } catch {
      return "Categorie opslaan mislukt: geen verbinding met de beheerservice.";
    }

    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) return result?.error ?? `Categorie opslaan mislukt (HTTP ${response.status}).`;
    return null;
  }

  async function saveEventEdits(
    e: React.FormEvent<HTMLFormElement>,
    event: EventRow
  ) {
    e.preventDefault();
    setError("");
    setMessage("");
    setEditError("");

    if (!supabase || !editDraft) {
      setEditError("Geen databaseverbinding. Vernieuw de pagina en probeer opnieuw.");
      return;
    }
    if (!editDraft.title.trim() || (!event.is_directory_entry && !editDraft.start_at)) {
      setEditError("Vul minimaal de titel en startdatum in.");
      return;
    }

    for (const value of [editDraft.website_url, editDraft.booking_url, editDraft.source_url]) {
      if (value.trim() && !normalizeWebAddress(value)) { setEditError("Controleer de webadressen. Je kunt ook een adres met www. invoeren."); return; }
    }
    setUpdatingEventId(event.id);
    let eventSaved = false;
    let uploadedPhotoPath: string | null = null;
    try {
      let uploadedImageUrl: string | null = null;
      if (editPhotoFile) {
        const photoForm = new FormData();
        photoForm.set("photo", await prepareEventPhoto(editPhotoFile));
        const response = await fetch("/api/visitor-event-photo", { method: "POST", body: photoForm });
        const result = await readApiJson<{ imageUrl?: string; path?: string; error?: string }>(response);
        if (!response.ok || !result.imageUrl || !result.path) {
          throw new Error(result.error ?? "De foto kon niet worden opgeslagen. Kies een JPG-, PNG- of WebP-foto van maximaal 5 MB.");
        }
        uploadedImageUrl = result.imageUrl;
        uploadedPhotoPath = result.path;
      }

      // Keep the importer’s stable, source-specific slug when editing an event.
      // Rebuilding it from the title can collide with another imported occurrence.
      const payload = {
        title: editDraft.title.trim(),
        short_description: editDraft.short_description.trim() || null,
        description: editDraft.description.trim() || null,
        start_at: event.is_directory_entry ? null : new Date(editDraft.start_at).toISOString(),
        end_at: event.is_directory_entry ? null : editDraft.end_at ? new Date(editDraft.end_at).toISOString() : null,
        venue_name: editDraft.venue_name.trim() || null,
        address: editDraft.address.trim() || null,
        postcode: editDraft.postcode.trim() || null,
        city: editDraft.city.trim() || null,
        price_from: editDraft.is_free || !editDraft.price_from ? null : Number(editDraft.price_from),
        price_to: editDraft.is_free || !editDraft.price_to ? null : Number(editDraft.price_to),
        is_free: editDraft.is_free,
        website_url: normalizeWebAddress(editDraft.website_url),
        booking_url: normalizeWebAddress(editDraft.booking_url),
        source_url: normalizeWebAddress(editDraft.source_url),
        ...(uploadedImageUrl ? { image_url: uploadedImageUrl } : {}),
      };
      const { data, error: updateError } = await supabase
        .from("events")
        .update(payload)
        .eq("id", event.id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        setEditError("Opslaan mislukt: " + updateError.message);
        return;
      }
      if (!data) {
        setEditError("De database heeft geen opgeslagen wijziging bevestigd. Controleer of je als beheerder bent ingelogd en probeer opnieuw.");
        return;
      }
      eventSaved = true;

      if (editDraft.category_id !== (event.category_id ?? "")) {
        const categoryError = await persistEventCategory(event.id, editDraft.category_id);
        if (categoryError) {
          setEditError(`De overige wijzigingen zijn opgeslagen, maar de categorie is niet aangepast: ${categoryError}`);
          await loadData();
          return;
        }
      }

      setEditingEventId(null);
      setEditDraft(null);
      setEditPhotoFile(null);
      setSavedEventId(event.id);
      setMessage(uploadedImageUrl
        ? `De wijzigingen en de evenementfoto bij “${payload.title}” zijn opgeslagen. Het bewerkingsvenster is gesloten.`
        : `“${payload.title}” is opgeslagen. Het bewerkingsvenster is gesloten.`);
      try {
        await loadData();
      } catch {
        setMessage("De wijziging is opgeslagen en het bewerkingsvenster is gesloten. Klik op Vernieuwen om de lijst bij te werken.");
      }
    } catch (cause) {
      setEditError(eventSaved
        ? "De wijziging is opgeslagen, maar er ging iets mis bij het bijwerken van de pagina. Klik op Vernieuwen."
        : `Opslaan is niet gelukt: ${cause instanceof Error ? cause.message : "controleer de verbinding en probeer opnieuw."}`);
    } finally {
      if (!eventSaved && uploadedPhotoPath) {
        try {
          await fetch("/api/visitor-event-photo", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: uploadedPhotoPath }),
          });
        } catch {
          // Keep the original save error visible; an orphaned upload can be cleaned up later.
        }
      }
      // Keep the editor usable after network failures or unexpected Supabase errors.
      setUpdatingEventId(null);
    }
  }

  function resetForm() {
    setTitle("");
    setShortDescription("");
    setDescription("");
    setStartAt("");
    setEndAt("");
    setVenueName("");
    setAddress("");
    setPostcode("");
    setCityChoice("");
    setCustomCity("");
    setVisitorPhoto(null);
    if (visitorPhotoInputRef.current) visitorPhotoInputRef.current.value = "";
    setPriceFrom("");
    setPriceTo("");
    setIsFree(false);
    setWebsiteUrl("https://");
    setBookingUrl("https://");
    setSourceUrl("https://");
    setCategoryId("");
    setPromotionType("none");
    setAdvertiser({...emptyAdvertiser});
    setEntryKind("event");
  }

  async function saveEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");
    setSubmissionNotice("");
    setSubmissionError("");

    if (!supabase) {
      setSubmissionError("Je tip kon niet worden verstuurd omdat de database niet bereikbaar is.");
      return;
    }

    if (!title.trim() || (entryKind === "event" && !startAt)) {
      setSubmissionError("Vul de titel en voor een evenement ook de startdatum in.");
      return;
    }
    if (promotionType !== "none") {
      try { validateAdvertiser(promotionType,advertiser); } catch(cause) { setSubmissionError(cause instanceof Error?cause.message:"Controleer de factuurgegevens.");return; }
    }

    const website = normalizeWebAddress(websiteUrl);
    const booking = normalizeWebAddress(bookingUrl);
    const source = normalizeWebAddress(sourceUrl);
    if (!website || !booking || !source) {
      setSubmissionError("Vul een geldig webadres in bij Website, Reserveringslink en Informatiebron. Een adres met www. wordt automatisch aangevuld met https://.");
      return;
    }
    if (promotionType === "category" && !categoryId) {
      setSubmissionError("Kies een categorie voor de categoriepromotie.");
      return;
    }
    setSaving(true);

    let uploadedImageUrl: string | null = null;
    let uploadedPhotoPath: string | null = null;
    let eventSaved = false;
    try {
      if (visitorPhoto) {
        const photoForm = new FormData();
        photoForm.set("photo", await prepareEventPhoto(visitorPhoto));
        const response = await fetch("/api/visitor-event-photo", { method: "POST", body: photoForm });
        const result = await readApiJson<{ imageUrl?: string; path?: string; error?: string }>(response);
        if (!response.ok || !result.imageUrl || !result.path) {
          throw new Error(result.error ?? "De foto kon niet worden opgeslagen. Probeer een JPG-, PNG- of WebP-foto van maximaal 5 MB.");
        }
        uploadedImageUrl = result.imageUrl;
        uploadedPhotoPath = result.path;
      }

      const payload = {
        title: title.trim(),
        submission_kind: "manual",
        slug: makeSlug(title),
        short_description: shortDescription.trim() || null,
        description: description.trim() || null,
        is_directory_entry: entryKind === "directory",
        start_at: entryKind === "directory" ? null : new Date(startAt).toISOString(),
        end_at: entryKind === "directory" ? null : endAt ? new Date(endAt).toISOString() : null,
        venue_name: venueName.trim() || null,
        address: address.trim() || null,
        postcode: postcode.trim() || null,
        city: (cityChoice === "__other__" ? customCity : cityChoice).trim() || null,
        price_from: isFree || priceFrom === "" ? null : Number(priceFrom),
        price_to: isFree || priceTo === "" ? null : Number(priceTo),
        is_free: isFree,
        website_url: website,
        booking_url: booking,
        source_url: source,
        image_url: uploadedImageUrl,
        promotion_type: promotionType,
        promotion_status: promotionType === "none" ? "none" : "requested",
        status: "pending",
        verified: false,
      };

      const response = await fetch("/api/visitor-events", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:payload,categoryId:categoryId||null,advertiser:promotionType==='none'?null:advertiser})});
      const result = await readApiJson<{error?:string;manageFragment?:string}>(response);
      if(!response.ok||!result.manageFragment)throw new Error(result.error||"De vermelding kon niet worden opgeslagen.");
      const privateLink=window.location.origin+"/mijn-vermelding#"+result.manageFragment;
      setManagementLink(privateLink);
      try {const links=JSON.parse(localStorage.getItem('cdd-managed-links')||'[]');links.push({title:payload.title,fragment:result.manageFragment});localStorage.setItem('cdd-managed-links',JSON.stringify(links));}catch{}

      eventSaved = true;
      resetForm();
      setShowForm(false);

      try {
        await loadData();
      } catch (cause) {
        console.error("[visitor-event] refresh after submission failed", cause);
      }
      const photoConfirmation = uploadedImageUrl ? " De foto is meegestuurd en verschijnt na controle bij het evenement." : "";
      setSubmissionNotice(promotionType === "none"
        ? `Dank je voor je tip over “${payload.title}”. De beheerder controleert de gegevens voordat het evenement in de agenda verschijnt.${photoConfirmation}`
        : `Dank je voor je tip over “${payload.title}”. De beheerder controleert eerst het evenement en neemt contact op over de gekozen betaalde promotie. De advertentie wordt pas na goedkeuring en betaling geplaatst.${photoConfirmation}`);
    } catch (cause) {
      console.error("[visitor-event] save failed", cause);
      setSubmissionError(cause instanceof Error ? cause.message : "De activiteit kon niet worden opgeslagen. Probeer het opnieuw.");
    } finally {
      if (!eventSaved && uploadedPhotoPath) {
        await fetch("/api/visitor-event-photo", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: uploadedPhotoPath }),
        }).catch(() => undefined);
      }
      setSaving(false);
    }
  }

  async function previewEventSource(endpoint: string, sourceName: string) {
    if (!isAdmin || importBusy.current || importing) return;
    importBusy.current=true;setActiveImport(endpoint);
    setError("");
    setMessage("");
    setImportNotice("");
    setImportLoading(true);
    setImportPreview([]);
    setImportSourceName(sourceName);
    try {
      const sources=endpoint==='all'?ALL_IMPORT_SOURCES:[{endpoint,name:sourceName}];
      const importedEvents=await fetchImportPreview<ImportedEvent>(sources,fetch,name=>setImportNotice(name+' ophalen…'));
      const preview = importedEvents.map((event) => ({
        ...event,
        category_id: suggestedCategoryId(event, categories),
      }));
      setImportPreview(preview);
      const withPhotos = preview.filter((event) => safeHttpUrl(event.image_url)).length;
      const withCategory = preview.filter((event) => event.category_id).length;
      setImportNotice(`${importedEvents.length} toekomstige of lopende activiteiten gevonden bij ${sourceName}. Dit is een voorvertoning; er is nog niets opgeslagen. ${withPhotos} hebben een evenementfoto uit een passende detailpagina; ${importedEvents.length - withPhotos} hebben geen foto op de beschikbare bronpagina. ${withCategory} hebben alvast een voorgestelde categorie. Na import kun je elk evenement controleren en de categorie wijzigen via BEWERKEN.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import voorbereiden is mislukt.");
    } finally {
      setImportLoading(false);setActiveImport(null);importBusy.current=false;
    }
  }

  async function previewTourismeDuras() {
    await previewEventSource("/api/import-tourisme-duras", "Tourisme Duras");
  }

  function previewSocialPost() {
    setSocialPostError("");
    if (!isAdmin) return;
    if (!socialPostUrl.trim()) {
      setSocialPostError("Plak eerst de link naar één specifiek bericht. Alleen de link naar de groep is niet genoeg.");
      return;
    }
    if (!isSocialPostUrl(socialPostUrl.trim())) {
      setSocialPostError("Deze link lijkt niet naar één Facebook- of Instagrambericht te gaan. Open het bericht zelf en kopieer de link via de datum of tijd boven het bericht.");
      return;
    }
    if (!socialPostTitle.trim() || !socialPostStartAt || !socialPostCity.trim() || !socialPostText.trim() || !socialPostCategoryId) {
      setSocialPostError("Vul titel, datum en tijd, plaats, berichttekst en categorie in voordat je de voorvertoning maakt.");
      return;
    }
    const sourceUrl = safeHttpUrl(socialPostUrl.trim());
    const imageUrl = socialPostImageUrl.trim() ? safeHttpUrl(socialPostImageUrl.trim()) : null;
    if (!sourceUrl) {
      setSocialPostError("De berichtlink moet met http:// of https:// beginnen.");
      return;
    }
    if (socialPostImageUrl.trim() && !imageUrl) {
      setSocialPostError("De fotolink moet met http:// of https:// beginnen.");
      return;
    }
    const start = parseLocalDateTime(socialPostStartAt);
    const end = socialPostEndAt ? parseLocalDateTime(socialPostEndAt) : null;
    if (!start || (socialPostEndAt && !end) || (end && end < start)) {
      setSocialPostError("Controleer de datum en tijd. De einddatum mag niet vóór de begindatum liggen.");
      return;
    }
    const host = new URL(sourceUrl).hostname.toLowerCase();
    const platformName = host.includes("instagram.com") ? "Instagram" : "Facebookgroep";
    const title = socialPostTitle.trim();
    const event: ImportPreviewEvent = {
      title,
      slug: makeSlug(`${title}-${socialPostStartAt.slice(0, 10)}`),
      short_description: null,
      description: socialPostText.trim(),
      start_at: start.toISOString(),
      end_at: end?.toISOString() ?? null,
      venue_name: socialPostVenue.trim() || null,
      address: null,
      postcode: null,
      city: socialPostCity.trim(),
      price_from: null,
      price_to: null,
      is_free: false,
      website_url: null,
      booking_url: null,
      contact_phone: null,
      image_url: imageUrl,
      organizer_name: platformName,
      source_category: `Social media · ${platformName}`,
      latitude: null,
      longitude: null,
      source_url: sourceUrl,
      status: "pending",
      verified: false,
      category_id: socialPostCategoryId,
    };
    setImportSourceName(`${platformName} · handmatige voorvertoning`);
    setImportPreview([event]);
    setImportNotice(`Eén bericht klaargezet voor controle. De kaart hieronder toont precies de evenementgegevens die worden opgeslagen. De tekst, datum, plaats en eventuele fotolink zijn overgenomen uit wat jij hierboven hebt ingevuld; er is nog niets opgeslagen.`);
    setError("");
    setMessage("");
  }

  async function importTourismeDuras() {
    if (!supabase || !isAdmin || importPreview.length === 0) return;
    setError("");
    setMessage("");
    setImporting(true);
    setImportNotice("");
    const supportedSources = importPreview.every(event => /^https:\/\/(www\.)?tourismeduras\.com\//.test(event.source_url)
      || event.source_url.startsWith("https://www.eymet-dordogne.fr/fr/rb/304280/lespace-culturel#agenda-")
      || event.source_url.startsWith("https://openagenda.com/")
      || /^https:\/\/(www\.)?(mairie-marmande\.fr|ville-miramontdeguyenne\.fr|commune-de-miramont-de-guyenne\.neopse-site\.com|pineuilh\.fr|saintefoylagrande\.fr)\//.test(event.source_url)
      || event.source_url.startsWith("https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-agenda-"));
    if (supportedSources) {
      let inserted = 0, skipped = 0, processed = 0;
      try {
        for (let offset = 0; offset < importPreview.length; offset += 50) {
          const batch = importPreview.slice(offset, offset + 50);
          const { data, error: importError } = await supabase.rpc("import_pending_source_events", { p_events: batch });
          if (importError) throw new Error(importError.message);
          inserted += Number(data?.inserted ?? 0); skipped += Number(data?.skipped ?? 0); processed += batch.length;
          setImportNotice(`${processed} van ${importPreview.length} gecontroleerd; ${inserted} toegevoegd, ${skipped} al aanwezig. Bestaande gegevens blijven behouden.`);
        }
        setMessage(`${inserted} nieuwe activiteiten toegevoegd; ${skipped} bestaande activiteiten behouden. Nieuwe activiteiten wachten op controle.`);
        setImportPreview([]);
        await loadData();
      } catch (cause) {
        setImportPreview(current => current.slice(processed));
        setError(`Import niet volledig afgerond: ${cause instanceof Error ? cause.message : "Verbindingsfout"}. ${inserted} toegevoegd; de resterende activiteiten blijven klaarstaan om opnieuw te proberen.`);
      } finally { setImporting(false); }
      return;
    }
    const sourceUrls = importPreview.map((event) => event.source_url);
    const existingResult = await supabase
      .from("events")
      .select("title,start_at,source_url,status,verified")
      .in("source_url", sourceUrls)
      .limit(1000);
    if (existingResult.error) {
      setError("Bestaande import controleren is mislukt: " + existingResult.error.message);
      setImporting(false);
      return;
    }

    const knownSourceUrls = new Set((existingResult.data ?? []).map((row) => row.source_url).filter(Boolean));
    const knownTitleDates = new Set([
      ...events.map((event) => `${event.title.trim().toLocaleLowerCase("fr-FR")}|${event.start_at.slice(0, 10)}`),
      ...(existingResult.data ?? []).map((event) => `${event.title.trim().toLocaleLowerCase("fr-FR")}|${event.start_at?.slice(0, 10)??''}`),
    ]);
    let inserted = 0;
    let enriched = 0;
    let skipped = 0;
    let skippedWithoutCategory = 0;
    let failedTitle = "";
    let failureMessage = "";
    for (const event of importPreview) {
      const titleDateKey = `${event.title.trim().toLocaleLowerCase("fr-FR")}|${event.start_at.slice(0, 10)}`;
      const existing = (existingResult.data ?? []).find((row) => row.source_url === event.source_url);
      if (existing) {
        if (existing.status === "pending" && existing.verified === false) {
          const { error: enrichError } = await supabase.rpc("enrich_pending_tourisme_event", {
            p_source_url: event.source_url,
            p_event: event,
            p_category_id: event.category_id || null,
          });
          if (enrichError) {
            failedTitle = event.title;
            failureMessage = `Aanvullen van “${event.title}” is mislukt: ${enrichError.message}. ${enriched} evenementen zijn aangevuld.`;
            break;
          }
          enriched += 1;
        } else {
          skipped += 1;
        }
        continue;
      }
      if (knownSourceUrls.has(event.source_url) || knownTitleDates.has(titleDateKey)) {
        skipped += 1;
        continue;
      }
      if (!event.category_id) skippedWithoutCategory += 1;
      const { category_id, ...eventPayload } = event;
      const { error: insertError } = await supabase.rpc("submit_pending_event", {
        p_event: eventPayload,
        p_category_id: category_id || null,
      });
      if (insertError) {
        failedTitle = event.title;
        failureMessage = `Import gestopt bij “${event.title}”: ${insertError.message}. ${inserted} nieuwe evenementen zijn toegevoegd; ${enriched} bestaande evenementen zijn aangevuld; ${skipped} zijn overgeslagen.`;
        break;
      }
      inserted += 1;
      knownSourceUrls.add(event.source_url);
      knownTitleDates.add(titleDateKey);
    }
    await loadData();
    if (failedTitle) setError(failureMessage);
    else setMessage(`${inserted} nieuwe evenementen van ${importSourceName} toegevoegd en ${enriched} wachtende imports aangevuld; ${skipped} goedgekeurde of dubbele evenementen overgeslagen. ${skippedWithoutCategory} import(s) hebben nog geen categorie en staan klaar om handmatig in te delen. Nieuwe inzendingen blijven wachten op controle.`);
    setImportPreview([]);
    setImporting(false);
  }

  function formatDate(value?: string | null) {
    if (!value) return "Vaste vermelding · controleer openingstijden bij de aanbieder";
    return new Date(value).toLocaleString("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatCardDate(value?: string | null) {
    if (!value) return { day: "—", month: "" };
    const date = new Date(value);
    return {
      day: date.toLocaleDateString("nl-NL", { day: "numeric" }),
      month: date.toLocaleDateString("nl-NL", { month: "short" }).replace(".", ""),
    };
  }

  function browseTheme(keywords: RegExp) {
    const matchingCategory = categories.find((category) => keywords.test(`${category.name ?? ""} ${category.slug ?? ""}`));
    setCategoryFilter(matchingCategory?.id ?? "all");
    setEventSearch("");
    document.getElementById("agenda-resultaten")?.scrollIntoView({ behavior: "smooth" });
  }

  const homepagePromotionEvents = placements.homepage;
  const featuredEvents = useMemo(
    () => upcomingHighlights(visibleNearbyEvents),
    [visibleNearbyEvents]
  );
  const municipalityServiceLabel = municipalityServiceOptions.find((option) => option.id === municipalityServiceType)?.label ?? "Dienst";
  const municipalityName = areaOptions.find((area) => area.id === municipalityAreaId)?.name ?? "Duras";
  const municipalityServiceRadiusKm: Record<MunicipalityServiceType, number> = {
    all: 60,
    mairie: 0,
    doctor: 15,
    hospital: 60,
    library: 20,
    pharmacy: 15,
    church: 15,
    tourism: 35,
    emergency: 0,
    dentist: 15,
    supermarket: 25,
    fuel: 25,
    charging: 25,
  };
  const municipalityServiceEntries: MunicipalityServiceEntry[] = !municipalityServiceInfo
    ? []
    : municipalityServiceType === "all"
      ? municipalityServiceInfo.services
      : municipalityServiceType === "mairie"
      ? municipalityServiceInfo.mairie
        ? [municipalityServiceInfo.mairie]
        : municipalityServiceInfo.services.filter((service) => service.type === "mairie")
      : municipalityServiceInfo.services.filter((service) => service.type === municipalityServiceType);
  const municipalityServiceGroupTypes = municipalityServiceOptions.filter((option) => option.id !== "all" && option.id !== "emergency");
  const municipalityMapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${municipalityServiceLabel} ${municipalityName}`)}`;
  const municipalityLibrarySearchUrl = `https://ccfr.bnf.fr/portailccfr/jsp/query_direct.jsp?query=rnbcd_menu_inst_pub&VILLE=${encodeURIComponent(municipalityName)}`;
  const municipalityDoctolibSearchUrl = `https://www.doctolib.fr/medecin-generaliste/${municipalityName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const renderMunicipalityServiceCard = (service: MunicipalityServiceEntry, index: number, groupType: MunicipalityServiceType) => {
    const groupLabel = municipalityServiceOptions.find((option) => option.id === groupType)?.label ?? municipalityServiceLabel;
    return <article className="municipality-service-card" key={`${groupType}-${service.id}`}>
      <div className="municipality-service-card-heading">
        <div><p className="section-kicker">{groupLabel}{service.inSelectedMunicipality === false ? ` · omgeving ${municipalityName}` : service.municipality ? ` · ${service.municipality}` : ""}{service.distanceKm != null ? ` · ${service.distanceKm} km` : ""}</p><h3>{service.name}</h3></div>
        {service.type === "hospital" && index === 0 && <span className="nearest-service-badge">Dichtstbij</span>}
      </div>
      {(groupType === "mairie" || municipalityServiceType === "all" && service.type === "mairie") && <p><strong>Burgemeester:</strong> {service.mayor ?? "Naam niet vermeld in de gemeentelijke contactgegevens."}</p>}
      {service.address && <p><strong>Adres:</strong> {service.address}</p>}
      {service.phone && <p><strong>Telefoon:</strong> <a href={`tel:${service.phone.replace(/[^\d+]/g, "")}`}>{service.phone}</a></p>}
      {service.email && <p><strong>E-mail:</strong> <a href={`mailto:${service.email}`}>{service.email}</a></p>}
      {service.openingHours && <p><strong>Openingstijden:</strong> {service.openingHours}</p>}
      {service.serviceTimes && <p><strong>Mis- of diensttijden:</strong> {service.serviceTimes}</p>}
      {(groupType === "church" || municipalityServiceType === "all" && service.type === "church") && !service.serviceTimes && <p className="municipality-missing-detail">Mis- of diensttijden zijn niet vermeld bij deze bron. Neem contact op met de kerk of parochie.</p>}
      {service.extra && <p>{service.extra}</p>}
      <div className="municipality-service-links">
        {safeHttpUrl(service.website) && <a href={safeHttpUrl(service.website)!} target="_blank" rel="noreferrer">Website <span aria-hidden="true">↗</span></a>}
        {safeHttpUrl(service.sourceUrl) && <a href={safeHttpUrl(service.sourceUrl)!} target="_blank" rel="noreferrer">Bron: {service.sourceName ?? "gegevens bekijken"} <span aria-hidden="true">↗</span></a>}
        {safeHttpUrl(service.secondarySourceUrl) && <a href={safeHttpUrl(service.secondarySourceUrl)!} target="_blank" rel="noreferrer">Extra bron: {service.secondarySourceName ?? "controleren"} <span aria-hidden="true">↗</span></a>}
        {(groupType === "mairie" || municipalityServiceType === "all" && service.type === "mairie") && safeHttpUrl(service.mayorSourceUrl) && <a href={safeHttpUrl(service.mayorSourceUrl)!} target="_blank" rel="noreferrer">Bron burgemeester: {service.mayorSourceName ?? "Ministerie van Binnenlandse Zaken"} <span aria-hidden="true">↗</span></a>}
        {safeHttpUrl(service.appointmentUrl) && <a href={safeHttpUrl(service.appointmentUrl)!} target="_blank" rel="noreferrer">Afspraak via Maiia <span aria-hidden="true">↗</span></a>}
        {(groupType === "doctor" || municipalityServiceType === "all" && service.type === "doctor") && <a href={safeHttpUrl(service.doctolibUrl) ?? municipalityDoctolibSearchUrl} target="_blank" rel="noreferrer">Doctolib <span aria-hidden="true">↗</span></a>}
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(service.latitude != null && service.longitude != null ? `${service.latitude},${service.longitude}` : `${service.name} ${service.address ?? municipalityName}`)}`} target="_blank" rel="noreferrer">Kaart: Google Maps <span aria-hidden="true">↗</span></a>
      </div>
    </article>;
  };
  function openEventEntryForm() {
    setError("");
    setMessage("");
    setShowForm(true);
    window.setTimeout(() => document.getElementById("activity-tip-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <main className="visitor-site">
      <header className="site-header">
        <div className="site-nav">
          <a className="brand-lockup" href="#top" aria-label="Côte de Duras, naar de startpagina">
            <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 64 44"><path d="M3 34 18 19l10 8 12-17 21 24H3Z"/><path d="M7 37h50M15 31h35"/><path d="M30 26v-9l5-5 5 5v9"/></svg></span>
            <span className="brand-name"><strong>CÔTE DE DURAS</strong></span>
          </a>
          <nav className="primary-nav" aria-label="Hoofdnavigatie">
            <a href="/de-streek-beleven">De streek beleven</a>
            <a href="#agenda">Agenda</a>
            <a href="#ontdekken">Ontdekken</a>
            <a href="#gemeenten">Gemeente informatie</a>
            <a href="#activity-tip-form" onClick={openEventEntryForm}>Nieuw evenement/vermelding</a>
            <a href="#gezondheid">Gezondheid</a>
            <a href="/mijn-vermelding">Mijn vermelding</a>
          </nav>
          <a className="region-note" href="/de-streek-beleven"><span aria-hidden="true">☀</span><span>De streek beleven</span></a>
        </div>
        <div className="hero-grid" id="top">
          <div className="hero-art" aria-hidden="true"><img src="/lot-et-garonne-hero.png" alt="" /></div>
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-copy">
            <p className="hero-kicker"><span aria-hidden="true" /> Leven, beleven en ontdekken in het zuidwesten</p>
            <h1>Côte de Duras</h1>
            <p className="hero-intro">Evenementen en informatie voor elke dag binnen een straal van 50 kilometer</p>
          </div>
        </div>
      </header>

      <section id="agenda" className="search-panel agenda-search-panel" aria-labelledby="nearby-heading">
        <div className="search-heading">
          <div>
            <p className="section-kicker">Agenda voor Duras en omgeving</p>
            <h2 id="nearby-heading">Vind jouw volgende uitje</h2>
            <p>Zoek eenvoudig op afstand, plaats, activiteit en categorie.</p>
          </div>
          <div className="search-count" aria-live="polite"><strong>{nearbyLoading ? "…" : nearbyEvents.length}</strong><span>activiteiten<br />in de buurt</span></div>
        </div>
        <div className="search-controls search-controls-primary">
          <label className="field-label" style={labelStyle}>
            Zoek binnen
            <select style={inputStyle} value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
              {[10, 25, 50].map((radius) => <option key={radius} value={radius}>{radius} kilometer</option>)}
            </select>
          </label>
          <button className="location-button" type="button" onClick={useCurrentLocation}>
            <span aria-hidden="true">⌖</span> Gebruik mijn locatie
          </button>
        </div>
        <div className="search-controls search-controls-secondary">
          <label className="field-label" style={labelStyle}>
            Zoek op activiteit
            <input style={inputStyle} value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} placeholder="Bijvoorbeeld markt of concert" />
          </label>
          <label className="field-label" style={labelStyle}>
            Plaats
            <select style={inputStyle} value={selectedAreaId} onChange={(event) => selectArea(event.target.value)}>
              {renderAreaOptions()}
            </select>
          </label>
          <label className="field-label" style={labelStyle}>
            Soort activiteit
            <select style={inputStyle} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Alle soorten</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name ?? category.slug ?? "Activiteit"}</option>)}
            </select>
          </label>
          <label className="free-filter" style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 9, paddingBottom: 12 }}>
            <input type="checkbox" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} />
            Alleen gratis activiteiten
          </label>
        </div>
        <div className="results-summary" role="status" aria-live="polite">
          <span className="results-indicator" aria-hidden="true" />
          <strong>{nearbyLoading ? "We zoeken iets leuks voor je…" : `${visibleNearbyEvents.length} ${visibleNearbyEvents.length === 1 ? "activiteit" : "activiteiten"} gevonden`}</strong>
          {!nearbyLoading && <span>binnen {radiusKm} km van {searchLabel}{categoryFilter !== "all" || eventSearch || freeOnly ? " met je huidige filters" : ""}</span>}
        </div>
        {visitorLocation && <p className="location-note">Je zoekt rond je huidige locatie. Deze locatie wordt alleen voor deze zoekopdracht gebruikt. <button className="location-reset-button" type="button" onClick={() => setVisitorLocation(null)}>Zoek weer rond {selectedArea?.name ?? "de gekozen plaats"}</button></p>}
      </section>

      <FloatingPromotions key={categoryFilter} events={categoryFilter==='all'?homepagePromotionEvents:categoryPromotionEvents} title={categoryFilter==='all'?'Uitgelicht op de homepage':'Uitgelicht in '+(categories.find(category=>category.id===categoryFilter)?.name??'deze categorie')} headingId={categoryFilter==='all'?'homepage-promotion-heading':'category-promotion-heading'} suppressed={!!selectedVisitorEvent||showForm} onOpen={event=>openVisitorEvent(event,categoryFilter==='all'?'homepage':'category')}/>

      <section id="agenda-resultaten" className="agenda-results-panel" aria-label="Agendaresultaten">
        {nearbyError && <p role="alert" style={{ padding: 12, background: "#fff1f2", color: "#9f1239", borderRadius: 8 }}>{nearbyError}</p>}
        {!nearbyLoading && !nearbyError && nearbyEvents.length === 0 && <p className="empty-results">Er staan nog geen gecontroleerde activiteiten binnen dit zoekgebied. Probeer een grotere straal of een andere plaats.</p>}
        {!nearbyLoading && !nearbyError && nearbyEvents.length > 0 && visibleNearbyEvents.length === 0 && <p className="empty-results">Geen activiteiten gevonden met deze zoekfilters. Pas je zoekterm of soort activiteit aan.</p>}
        {locationlessCount > 0 && <p className="location-note">{locationlessCount} aankomende {locationlessCount === 1 ? "activiteit heeft" : "activiteiten hebben"} nog geen herkenbare plaats en kan daarom niet op afstand worden getoond.</p>}

        <div className="event-grid" aria-label="Aankomende activiteiten">
          {displayedNearbyEvents.map((event) => (
            <article data-analytics-card="true" data-analytics-event={event.id} data-analytics-placement={event.promotion_status === "active" && event.promotion_type === "highlight" ? "highlight" : "standard"} className={`activity-card${event.promotion_type === "highlight" && event.promotion_status === "active" ? " activity-card-highlighted" : ""}`} key={event.id}>
              <div className="activity-media">
                <button className="activity-image-trigger" type="button" onClick={() => openVisitorEvent(event, event.promotion_status === "active" && event.promotion_type === "highlight" ? "highlight" : "standard")} aria-label={`Bekijk ${event.title}`}>
                  {safeHttpUrl(event.image_url)
                    ? <img className="activity-image" src={safeHttpUrl(event.image_url)!} alt="" loading="lazy" />
                    : <span className="activity-image-placeholder"><span aria-hidden="true">47</span><small>Ontdek dichtbij</small></span>}
                </button>
                <span className="distance-pill">{event.distance_is_approximate ? "ca. " : ""}{event.distance_km} km</span>
              </div>
              <div className="activity-card-content">
                <div className="activity-tags">
                  {event.category_ids?.length ? <span className="category-pill">{event.category_ids.map(id => categories.find(category => category.id === id)?.name).filter(Boolean).join(" · ")}</span> : null}
                  {event.is_free && <span className="free-pill">Gratis</span>}
                  {event.promotion_type === "highlight" && event.promotion_status === "active" && <span className="sponsored-label">Uitgelicht</span>}
                  {categoryFilter !== "all" && event.category_ids?.includes(categoryFilter) && event.promotion_type === "category" && event.promotion_status === "active" && <span className="sponsored-label">Categoriepartner</span>}
                </div>
                <h3><button className="activity-title-button" type="button" onClick={() => openVisitorEvent(event, event.promotion_status === "active" && event.promotion_type === "highlight" ? "highlight" : "standard")}>{event.title}</button></h3>
                <p className="activity-date">{formatDate(event.start_at)}{event.end_at ? ` – ${formatDate(event.end_at)}` : ""}</p>
                <p className="activity-place"><span aria-hidden="true">⌖</span> {[event.venue_name, event.address, event.postcode, event.city].filter(Boolean).join(", ") || event.city}</p>
                {(event.short_description || event.description) && <p className="activity-description">{event.short_description || event.description}</p>}
                <div className="activity-links">
                  <button className="activity-link activity-link-detail" type="button" onClick={() => openVisitorEvent(event, event.promotion_status === "active" && event.promotion_type === "highlight" ? "highlight" : "standard")}>Bekijk evenementdetails <span aria-hidden="true">→</span></button>
                  {safeHttpUrl(event.booking_url) && <a className="activity-link activity-link-primary" data-analytics-channel="booking" href={safeHttpUrl(event.booking_url)!} target="_blank" rel="noreferrer">Reserveren <span aria-hidden="true">↗</span></a>}
                  {safeHttpUrl(event.website_url) && <a className="activity-link" data-analytics-channel="website" href={safeHttpUrl(event.website_url)!} target="_blank" rel="noreferrer">Website <span aria-hidden="true">↗</span></a>}
                  {safeHttpUrl(event.source_url) && <a className="activity-link" data-analytics-channel="source" href={safeHttpUrl(event.source_url)!} target="_blank" rel="noreferrer">Meer informatie <span aria-hidden="true">↗</span></a>}
                </div>
                <p className="external-link-note">Externe pagina’s openen in een nieuw tabblad; deze agenda blijft open.</p>
                {event.source_url && <p className="activity-source">Bron: {sourceLabel(event.source_url)}</p>}
              </div>
            </article>
          ))}
        </div>
        {displayedNearbyEvents.length < standardNearbyEvents.length && <button className="show-more-events" type="button" onClick={() => setVisibleEventCount((count) => Math.min(count + 18, standardNearbyEvents.length))}>Toon meer activiteiten ({standardNearbyEvents.length - displayedNearbyEvents.length} resterend)</button>}
        <div className="tip-invitation" id="tip-activiteit">
          <div><p className="section-kicker">Ken jij de streek?</p><strong>Staat jouw favoriete activiteit er nog niet bij?</strong><p>Geef de tip door. De beheerder controleert de informatie voordat bezoekers het evenement zien.</p><p>Al een vermelding ingestuurd? <a href="/mijn-vermelding">Beheer je vermelding →</a></p></div>
          <button className="button button-dark" type="button" onClick={openEventEntryForm} aria-controls="activity-tip-form">
            Een nieuw evenement/vermelding<span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <section className="discovery-section" id="ontdekken" aria-label="Ontdek de streek">
        <a className="discovery-tile discovery-agenda" href="#agenda"><span className="discovery-icon" aria-hidden="true">▦</span><span><strong>Agenda</strong><small>Wat is er te doen?</small></span><span className="discovery-arrow" aria-hidden="true">→</span></a>
        <a className="discovery-tile discovery-towns" href="#gemeenten"><span className="discovery-icon" aria-hidden="true">⌖</span><span><strong>Gemeentegids</strong><small>Lokale diensten & adressen</small></span><span className="discovery-arrow" aria-hidden="true">→</span></a>
      </section>


      <section className="featured-section" aria-labelledby="featured-heading">
        <div className="content-heading"><div><p className="section-kicker">Ideeën voor binnenkort</p><h2 id="featured-heading">Binnenkort in de buurt</h2></div><a className="text-arrow-link" href="#agenda-resultaten">Naar de agenda <span aria-hidden="true">→</span></a></div>
        {featuredEvents.length > 0 ? <div className="featured-events-grid">
          {featuredEvents.map((event) => {
            const date = formatCardDate(event.start_at);
            return <article data-analytics-card="true" data-analytics-event={event.id} data-analytics-placement={"standard"} className={`featured-event-card${event.promotion_type === "homepage" && event.promotion_status === "active" ? " featured-event-card-sponsored" : ""}`} key={`featured-${event.id}`}>
              <button className="featured-event-image" type="button" onClick={() => openVisitorEvent(event)} aria-label={`Bekijk ${event.title}`}>
                {safeHttpUrl(event.image_url) ? <img src={safeHttpUrl(event.image_url)!} alt="" loading="lazy" /> : <span className="featured-image-art" aria-hidden="true">47</span>}
              </button>
              <div className="featured-event-body"><span className="date-tile"><strong>{date.day}</strong><small>{date.month}</small></span><div>{event.promotion_type === "homepage" && event.promotion_status === "active" && <span className="sponsored-label">Uitgelicht</span>}<h3><button className="featured-event-title" type="button" onClick={() => openVisitorEvent(event)}>{event.title}</button></h3><p><span aria-hidden="true">⌖</span> {event.city || event.venue_name || "Lot-et-Garonne"}</p></div></div>
            </article>;
          })}
        </div> : <div className="featured-empty"><span className="featured-empty-icon" aria-hidden="true">✦</span><div><strong>{nearbyLoading ? "We zoeken activiteiten in de buurt…" : "Er wordt gewerkt aan de agenda voor deze plaats."}</strong><p>Kies een gemeente of bekijk de agenda voor Duras en omgeving.</p></div><a className="text-arrow-link" href="#agenda">Ontdek de agenda <span aria-hidden="true">→</span></a></div>}
      </section>



      <section className="area-explorer municipality-info-panel" id="gemeenten" aria-labelledby="area-heading">
        <div className="area-explorer-copy municipality-info-copy">
          <p className="section-kicker">Gemeentegids Côte de Duras en omgeving</p>
          <h2 id="area-heading">Praktische informatie per gemeente.</h2>
          <p>Kies een plaats en dienst voor contactgegevens, adressen en waar beschikbaar openingstijden. De lijst gebruikt de officiële Franse overheidsdirectory en actuele kaartgegevens.</p>
        </div>
        <div className="municipality-directory">
          <form className="municipality-service-controls" onSubmit={findMunicipalityServices}>
            <label className="field-label">
              Gemeente of dorp
              <select className="municipality-select" value={municipalityAreaId} onChange={(event) => {
                setMunicipalityAreaId(event.target.value);
                setMunicipalityServiceInfo(null);
                setMunicipalitySearchComplete(false);
                setMunicipalityServicesError("");
              }}>
                {renderAreaOptions()}
              </select>
            </label>
            <label className="field-label">
              Welke informatie zoek je?
              <select className="municipality-select" value={municipalityServiceType} onChange={(event) => {
                setMunicipalityServiceType(event.target.value as MunicipalityServiceType);
                setMunicipalityServiceInfo(null);
                setMunicipalitySearchComplete(false);
                setMunicipalityServicesError("");
              }}>
                {municipalityServiceOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <button className="municipality-search-button" type="submit" disabled={municipalityServicesLoading}>
              {municipalityServicesLoading ? "Informatie ophalen…" : "Toon informatie"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="municipality-data-note">Kies ‘Alle categorieën’ om de diensten voor een gemeente tegelijk te bekijken. Officiële gemeentetellingen vullen de adressen aan. Resultaten buiten de gemeente tonen hun werkelijke plaats en afstand; ontbrekende adressen worden als ontbrekende broninformatie aangeduid.</p>
          {municipalityServicesError && <p className="municipality-feedback municipality-feedback-error" role="alert">{municipalityServicesError}</p>}
          {municipalityServicesLoading && <p className="municipality-feedback" role="status">{municipalityServiceType === "all" ? `We verzamelen nu alle gemeentelijke diensten voor ${municipalityName}, inclusief voorzieningen in de directe omgeving.` : `We zoeken ${municipalityServiceLabel.toLocaleLowerCase("nl-NL")} ${municipalityServiceRadiusKm[municipalityServiceType] > 0 ? `in ${municipalityName} en tot ${municipalityServiceRadiusKm[municipalityServiceType]} km eromheen` : `in de gemeente ${municipalityName}`}.`}</p>}
          {municipalitySearchComplete && municipalityServiceType === "emergency" && (
            <div className="emergency-number-grid" aria-label="Franse noodnummers">
              {frenchEmergencyNumbers.map((item) => <article className="emergency-number-card" key={item.number}>
                <a href={`tel:${item.number}`} aria-label={`Bel ${item.number}, ${item.name}`}>{item.number}</a>
                <strong>{item.name}</strong>
                <span>{item.note}</span>
              </article>)}
              <p className="municipality-source-note">Deze Franse noodnummers gelden ook in {municipalityName}. <a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F33954" target="_blank" rel="noreferrer">Officiële informatie van Service-Public</a>.</p>
            </div>
          )}
          {municipalitySearchComplete && municipalityServiceType !== "emergency" && municipalityServiceInfo && (
            <div className="municipality-results" aria-live="polite">
              {municipalityServiceType === "all" ? <>
                {municipalityServiceGroupTypes.map((option) => {
                  const groupEntries = municipalityServiceEntries.filter((service) => service.type === option.id);
                  const equipmentCount = municipalityServiceInfo.officialEquipmentCounts?.find((item) => item.service === option.id);
                  const radius = municipalityServiceRadiusKm[option.id];
                  const localEntryCount = groupEntries.filter((entry) => entry.inSelectedMunicipality !== false).length;
                  const nearbyEntryCount = groupEntries.filter((entry) => entry.inSelectedMunicipality === false).length;
                  return <section className="municipality-service-group" key={option.id}>
                    <div className="municipality-service-group-heading"><div><p className="section-kicker">Gemeentegids · {municipalityName}</p><h3>{option.label}</h3></div><span>{groupEntries.length} vermeldingen</span></div>
                    {equipmentCount && <p className="municipality-data-note"><strong>INSEE {equipmentCount.year}:</strong> {equipmentCount.basis} De bronnen hieronder tonen {localEntryCount} concrete vermeldingen in {municipalityName}{nearbyEntryCount ? ` en ${nearbyEntryCount} in de omgeving` : ""}.{localEntryCount < equipmentCount.count ? ` Voor ${equipmentCount.count - localEntryCount} voorzieningen kon nog geen afzonderlijk openbaar adres worden bevestigd.` : ""}</p>}
                    {groupEntries.length ? <div className="municipality-service-group-cards">{groupEntries.map((entry, index) => renderMunicipalityServiceCard(entry, index, option.id))}</div> : <div className="municipality-empty-result">
                      <strong>{equipmentCount?.count ? `INSEE registreert ${equipmentCount.count} ${option.label.toLocaleLowerCase("nl-NL")} in ${municipalityName}, maar de gekoppelde openbare adresbronnen geven op dit moment geen individuele vermeldingen terug.` : `Geen controleerbaar adres gevonden voor ${option.label.toLocaleLowerCase("nl-NL")} ${radius > 0 ? `in ${municipalityName} of binnen ${radius} km` : `in ${municipalityName}`}.`}</strong>
                    {equipmentCount && <p>De officiële telling geeft het aantal voorzieningen. Namen en adressen worden alleen getoond wanneer een openbare bron die per voorziening bevestigt.</p>}
                      <p>We vullen alleen namen en contactgegevens in wanneer een bron ze bevestigt.</p>
                      <div className="municipality-service-links">
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${option.label} ${municipalityName}`)}`} target="_blank" rel="noreferrer">Zoek op Google Maps <span aria-hidden="true">↗</span></a>
                        {option.id === "library" && <a href={municipalityLibrarySearchUrl} target="_blank" rel="noreferrer">Bibliotheekregister van de BnF <span aria-hidden="true">↗</span></a>}
                        {option.id === "doctor" && <a href={municipalityDoctolibSearchUrl} target="_blank" rel="noreferrer">Huisartsen op Doctolib <span aria-hidden="true">↗</span></a>}
                        <a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${option.label} ${municipalityName}`)}`} target="_blank" rel="noreferrer">OpenStreetMap <span aria-hidden="true">↗</span></a>
                      </div>
                    </div>}
                  </section>;
                })}
                <section className="municipality-service-group municipality-emergency-group">
                  <div className="municipality-service-group-heading"><div><p className="section-kicker">Geldt in heel Frankrijk</p><h3>Noodnummers</h3></div></div>
                  <div className="emergency-number-grid" aria-label={`Franse noodnummers voor ${municipalityName}`}>
                    {frenchEmergencyNumbers.map((item) => <article className="emergency-number-card" key={item.number}>
                      <a href={`tel:${item.number}`} aria-label={`Bel ${item.number}, ${item.name}`}>{item.number}</a>
                      <strong>{item.name}</strong>
                      <span>{item.note}</span>
                    </article>)}
                  </div>
                  <p className="municipality-source-note"><a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F33954" target="_blank" rel="noreferrer">Officiële informatie van Service-Public</a>.</p>
                </section>
              </> : <>
                {municipalityServiceInfo.officialEquipmentCount && <p className="municipality-data-note">
                  <strong>Officiële gemeentetelling ({municipalityServiceInfo.officialEquipmentCount.year}):</strong> {municipalityServiceInfo.officialEquipmentCount.basis} De bronnen hieronder tonen {municipalityServiceEntries.filter((entry) => entry.inSelectedMunicipality !== false).length} concrete vermeldingen in {municipalityName}{municipalityServiceEntries.filter((entry) => entry.inSelectedMunicipality === false).length ? ` en ${municipalityServiceEntries.filter((entry) => entry.inSelectedMunicipality === false).length} in de omgeving` : ""}.{municipalityServiceEntries.filter((entry) => entry.inSelectedMunicipality !== false).length < municipalityServiceInfo.officialEquipmentCount.count ? ` Voor ${municipalityServiceInfo.officialEquipmentCount.count - municipalityServiceEntries.filter((entry) => entry.inSelectedMunicipality !== false).length} voorzieningen kon nog geen afzonderlijk openbaar adres worden bevestigd.` : ""}
                </p>}
                {municipalityServiceEntries.length > 0 ? municipalityServiceEntries.map((entry, index) => renderMunicipalityServiceCard(entry, index, municipalityServiceType)) : <div className="municipality-empty-result">
                  <strong>{municipalityServiceInfo.officialEquipmentCount?.count ? `INSEE registreert ${municipalityServiceInfo.officialEquipmentCount.count} ${municipalityServiceLabel.toLocaleLowerCase("nl-NL")} in ${municipalityName}, maar de gekoppelde openbare adresbronnen geven op dit moment geen individuele vermeldingen terug.` : `Geen ${municipalityServiceLabel.toLocaleLowerCase("nl-NL")} gevonden ${municipalityServiceRadiusKm[municipalityServiceType] > 0 ? `in ${municipalityName} of binnen ${municipalityServiceRadiusKm[municipalityServiceType]} km` : `in ${municipalityName}`} in de beschikbare gegevens.`}</strong>
                  <p>Een lege vermelding betekent niet dat deze dienst niet bestaat. Bekijk de kaart of neem contact op met het gemeentehuis.</p>
                  <div className="municipality-service-links">
                    <a href={municipalityMapSearchUrl} target="_blank" rel="noreferrer">Zoek op Google Maps <span aria-hidden="true">↗</span></a>
                    {municipalityServiceType === "library" && <a href={municipalityLibrarySearchUrl} target="_blank" rel="noreferrer">Zoek in het bibliotheekregister van de BnF <span aria-hidden="true">↗</span></a>}
                    {municipalityServiceType === "doctor" && <a href={municipalityDoctolibSearchUrl} target="_blank" rel="noreferrer">Zoek huisartsen op Doctolib <span aria-hidden="true">↗</span></a>}
                    <a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${municipalityServiceLabel} ${municipalityName}`)}`} target="_blank" rel="noreferrer">OpenStreetMap <span aria-hidden="true">↗</span></a>
                  </div>
                </div>}
              </>}
              <p className="municipality-source-note">
                Geraadpleegd op {new Date(municipalityServiceInfo.updatedAt).toLocaleDateString("nl-NL")}.
                {municipalityServiceInfo.sources?.length ? <> Controleer ook deze aanvullende bronnen:{municipalityServiceInfo.sources.map((source) => <span key={source.url}> <a href={safeHttpUrl(source.url) ?? "#"} target="_blank" rel="noreferrer">{source.name} <span aria-hidden="true">↗</span></a>.</span>)}</> : null}
                {municipalityServiceType !== "mairie" && municipalityServiceEntries.some((service) => service.sourceName === "OpenStreetMap") && municipalityServiceInfo.mapDataAvailable && <> Aanvullende kaartgegevens: © OpenStreetMap-bijdragers.</>}
              </p>
              {!municipalityServiceInfo.mapDataAvailable && !municipalityServiceInfo.curatedDataAvailable && <p className="municipality-feedback municipality-feedback-error">De kaartgegevens zijn tijdelijk niet bereikbaar. De links naar Google Maps en Doctolib blijven beschikbaar.</p>}
              {!municipalityServiceInfo.mapDataAvailable && municipalityServiceInfo.curatedDataAvailable && <p className="municipality-data-note">De officiële vermeldingen hierboven zijn beschikbaar. De aanvullende OpenStreetMap-resultaten zijn tijdelijk niet bereikbaar.</p>}
            </div>
          )}
        </div>
      </section>

      <section className="visitor-guides" aria-label="Ontdek meer over de streek">
        <article className="guide-card guide-health" id="gezondheid">
          <span className="guide-icon" aria-hidden="true">♡</span>
          <p className="section-kicker">Zorg & gezondheid</p>
          <h2>Goed voor jezelf zorgen begint ook buiten.</h2>
          <p>Even wandelen, samen op pad of iets nieuws proberen? Bekijk activiteiten in en rond de gemeenten die nu in de agenda staan.</p>
          <a href="#agenda">Bekijk activiteiten <span aria-hidden="true">→</span></a>
        </article>
      </section>

      {showForm && (
        <form
          id="activity-tip-form"
          className="visitor-form"
          onSubmit={saveEvent}
          style={{
            display: "grid",
            gap: 16,
            padding: 20,
            background: "white",
            border: "1px solid #d8dee8",
            borderRadius: 12,
            marginBottom: 28,
          }}
        >
          <h2>Een nieuw evenement/vermelding</h2>
          <p className="listing-management-entry">Al een vermelding ingestuurd? <a href="/mijn-vermelding">Beheer je vermelding →</a></p>
          <button type="button" onClick={() => setShowForm(false)} disabled={saving} style={{ justifySelf: "end" }}>Formulier sluiten</button>
          <p style={{ marginTop: 0, color: "#64748b" }}>
            Je tip komt eerst bij de beheerder ter controle. Een link naar de organisator of informatiebron helpt ons de gegevens te verifiëren.
          </p>

          <div className="visitor-photo-field visitor-photo-field-prominent">
            <label htmlFor="visitor-event-photo" style={labelStyle}>Foto van het evenement uploaden (optioneel)</label>
            <input
              id="visitor-event-photo"
              ref={visitorPhotoInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (!file) { setVisitorPhoto(null); return; }
                if (!eventPhotoType(file)) {
                  setVisitorPhoto(null);
                  event.target.value = "";
                  setSubmissionError("Kies een foto in JPG-, PNG- of WebP-formaat.");
                  return;
                }
                if (file.size > MAX_VISITOR_PHOTO_BYTES) {
                  setVisitorPhoto(null);
                  event.target.value = "";
                  setSubmissionError("De foto mag maximaal 5 MB groot zijn.");
                  return;
                }
                setSubmissionError("");
                setVisitorPhoto(file);
              }}
            />
            <p className="visitor-photo-help">Klik op ‘Bestand kiezen’ om een foto vanaf je telefoon of computer toe te voegen. JPG, PNG of WebP, maximaal 5 MB. De foto verschijnt na controle door de beheerder.</p>
            {visitorPhotoPreview && <div className="visitor-photo-preview"><img src={visitorPhotoPreview} alt="Voorbeeld van de gekozen evenementfoto" /><button type="button" onClick={() => { setVisitorPhoto(null); if (visitorPhotoInputRef.current) visitorPhotoInputRef.current.value = ""; }}>Foto verwijderen</button></div>}
          </div>

          <fieldset className="promotion-fieldset">
            <legend>Extra bereik voor je evenement (optioneel)</legend>
            <p>Kies je vermelding. Bij een betaalde optie verschijnen hieronder de advertentieperiode en factuurgegevens. Sla daarna je vermelding op en open ‘Mijn vermelding beheren’ om via Mollie te betalen. De advertentie verschijnt na goedkeuring en betaalbevestiging, binnen de gekozen periode.</p>
            <div className="promotion-options">
              {([
                ["none", "Gratis vermelding (standaard)", "Je evenement komt na goedkeuring gewoon in de agenda, zonder advertentiekosten."],
                ["homepage", "Op de homepage · €149 per maand", "Maximaal 9 advertenties zichtbaar bij ‘Uitgelicht op de homepage’."],
                ["category", "Bovenaan de categorie · €79 per maand", "Maximaal 9 advertenties zichtbaar per gekozen categorie."],
                ["highlight", "Vetomrand in resultaten · €15 per maand", "Een opvallend kader in de resultaten. Geen limiet aan het aantal vermeldingen."],
              ] as const).map(([value, heading, copy]) => <label className={`promotion-option${promotionType === value ? " promotion-option-selected" : ""}`} key={value}>
                <input type="radio" name="promotion-type" value={value} checked={promotionType === value} aria-controls={value==='none'?undefined:'advertiser-details'} onChange={() => {setPromotionType(value);if(value!=='none')requestAnimationFrame(()=>document.getElementById('advertiser-details')?.scrollIntoView({behavior:'smooth',block:'center'}));}} />
                <span><strong>{heading}</strong><small>{copy}</small></span>
              </label>)}
            </div>
            {promotionType !== "none" && <section id="advertiser-details" aria-label="Gekozen advertentie"><p role="status"><strong>Gekozen: {promotionType==='homepage'?'homepagevermelding':promotionType==='category'?'categorievermelding':'vetomrande vermelding'}.</strong> Vul hieronder je periode en factuurgegevens in en sla vervolgens het formulier op.</p><AdvertiserFields type={promotionType} value={advertiser} onChange={setAdvertiser}/></section>}
          </fieldset>

          <label style={labelStyle}>Wat wil je invoeren?<select style={inputStyle} value={entryKind} onChange={e=>setEntryKind(e.target.value)}><option value="event">Evenement met datum</option><option value="directory">Vaste vermelding / bedrijf / accommodatie</option></select></label>
          <div>
            <label style={labelStyle}>Titel *</label>
            <input
              style={inputStyle}
              maxLength={180}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijvoorbeeld: Marché nocturne"
            />
          </div>

          <div>
            <label style={labelStyle}>Categorie{promotionType === "category" ? " * (verplicht voor categoriepromotie)" : ""}</label>
            <select
              style={inputStyle}
              required={promotionType === "category"}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Kies een categorie</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name ?? category.slug ?? category.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Korte beschrijving</label>
            <input
              style={inputStyle}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              maxLength={250}
            />
          </div>

          <div>
            <label style={labelStyle}>Uitgebreide beschrijving</label>
            <textarea
              style={{ ...inputStyle, minHeight: 110 }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {entryKind === "event" && <>
          <div>
            <label style={labelStyle}>Begindatum en -tijd *</label>
            <input
              style={inputStyle}
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Einddatum en -tijd</label>
            <input
              style={inputStyle}
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>

          </>}
          <div>
            <label style={labelStyle}>Locatie / zaal</label>
            <input
              style={inputStyle}
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Adres</label>
            <input
              style={inputStyle}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Postcode</label>
            <input
              style={inputStyle}
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="visitor-event-city" style={labelStyle}>Plaats *</label>
            <select
              id="visitor-event-city"
              style={inputStyle}
              required
              value={cityChoice}
              onChange={(e) => {
                setCityChoice(e.target.value);
                setCustomCity("");
              }}
            >
              <option value="" disabled>Kies een plaats</option>
              {alphabeticalPlaces(areaOptions).map(area => <option key={area.id} value={area.name}>{area.name}</option>)}
              <option value="__other__">Andere plaats…</option>
            </select>
            {cityChoice === "__other__" && (
              <input
                style={{ ...inputStyle, marginTop: 8 }}
                aria-label="Andere plaatsnaam"
                required
                maxLength={120}
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="Vul de plaatsnaam in"
              />
            )}
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
            />
            Dit evenement is gratis
          </label>

          {!isFree && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 12,
              }}
            >
              <div>
               <label style={labelStyle}>Prijs vanaf (&euro;)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceFrom}
                  onChange={(e) => setPriceFrom(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Prijs tot (€)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceTo}
                  onChange={(e) => setPriceTo(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="event-websiteUrl" style={labelStyle}>Website * — https://</label>
            <input id="event-websiteUrl" style={inputStyle} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" required value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} onBlur={() => { const address = normalizeWebAddress(websiteUrl); if (address) setWebsiteUrl(address); }} placeholder="https://www.voorbeeld.fr" />
          </div>

          <div>
            <label htmlFor="event-bookingUrl" style={labelStyle}>Reserveringslink * — https://</label>
            <input id="event-bookingUrl" style={inputStyle} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" required value={bookingUrl} onChange={e => setBookingUrl(e.target.value)} onBlur={() => { const address = normalizeWebAddress(bookingUrl); if (address) setBookingUrl(address); }} placeholder="https://www.voorbeeld.fr" />
          </div>

          <div>
            <label htmlFor="event-sourceUrl" style={labelStyle}>Informatiebron * — https://</label>
            <input id="event-sourceUrl" style={inputStyle} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" required value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} onBlur={() => { const address = normalizeWebAddress(sourceUrl); if (address) setSourceUrl(address); }} placeholder="https://www.voorbeeld.fr" />
          </div>

          <p>Je kunt ook www.voorbeeld.fr invoeren; https:// wordt automatisch toegevoegd. Gebruik dezelfde website als er geen aparte reserveringspagina of bronpagina is.</p>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: 14,
              border: 0,
              borderRadius: 8,
              background: saving ? "#94a3b8" : "#16734b",
              color: "white",
              cursor: saving ? "wait" : "pointer",
              fontSize: 16,
            }}
          >
            {saving ? "Opslaan..." : "Evenement/vermelding opslaan"}
          </button>
        </form>
      )}

      {submissionError && <p role="alert" style={{ padding: 12, background: "#fff1f2", color: "#9f1239", borderRadius: 8 }}>{submissionError}</p>}
      {managementLink && <aside className="management-link-notice" aria-labelledby="management-confirmation-title"><h3 id="management-confirmation-title">Je vermelding is ingestuurd — bewaar je beheerlink</h3><p>Met deze persoonlijke link kun je zelf de tekst, datum, contactgegevens en foto wijzigen, zonder account. Bewaar de link als een wachtwoord en deel hem niet met anderen.</p><a className="button button-dark" href={managementLink}>Mijn vermelding beheren →</a><label>Persoonlijke link<input readOnly value={managementLink} onFocus={e=>e.target.select()}/></label><div className="management-link-actions"><button type="button" onClick={()=>void navigator.clipboard.writeText(managementLink).catch(()=>setSubmissionError("Selecteer en kopieer de persoonlijke link hierboven."))}>Beheerlink kopiëren</button><a download="Cote-de-Duras-beheerlink.txt" href={'data:text/plain;charset=utf-8,'+encodeURIComponent('Persoonlijke beheerlink Côte de Duras\n\n'+managementLink+'\n\nBewaar deze link als een wachtwoord. Iedereen met deze link kan je vermelding wijzigen.\n')}>Beheerlink bewaren als bestand</a></div><p>Ook terug te vinden onder ‘Beheer je vermelding’ op dit apparaat, zolang de browsergegevens bewaard blijven. Er wordt nog geen automatische e-mail verstuurd.</p></aside>}
      {submissionNotice && <p role="status" style={{ padding: 12, background: "#ecfdf5", color: "#065f46", borderRadius: 8 }}>{submissionNotice}</p>}

      <AnalyticsConsent disabled={isAdmin || authLoading} />
      <footer className="site-footer">
        <a className="brand-lockup footer-brand" href="#top" aria-label="Terug naar boven">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 64 44"><path d="M3 34 18 19l10 8 12-17 21 24H3Z"/><path d="M7 37h50M15 31h35"/><path d="M30 26v-9l5-5 5 5v9"/></svg></span>
          <span className="brand-name"><strong>CÔTE DE DURAS</strong><small>Evenementen en informatie binnen 50 kilometer</small></span>
        </a>
        <div><a href="#agenda">Agenda</a><a href="#gemeenten">Gemeenten</a><a href="/disclaimer">Disclaimer</a><a href="/contact">Contactgegevens</a><a href="#activity-tip-form" onClick={openEventEntryForm}>Nieuw evenement/vermelding</a><button className="footer-admin-link" type="button" onClick={() => { const panel = document.getElementById("beheer") as HTMLDetailsElement | null; if (panel) { panel.open = true; panel.scrollIntoView({ behavior: "smooth", block: "start" }); } }}>Beheerderslogin</button></div>
        <span className="footer-note">Een streek vol verhalen, ontmoetingen en kleine ontdekkingen.</span>
      </footer>

      <details id="beheer" onToggle={(event) => { if (event.currentTarget.open) setAdminContentMounted(true); }} style={{ margin: "28px 0", padding: 16, background: "#f8fafc", border: "1px solid #d8dee8", borderRadius: 10 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>Beheerdersdashboard</summary>
      {adminContentMounted && <>
      <h2>Beheerdersdashboard</h2>

      {authLoading ? (
        <p>Inlogstatus controleren...</p>
      ) : user ? (
        <p>
          Ingelogd als <strong>{user.email}</strong>{" "}
          <button type="button" onClick={() => void signOut()}>Uitloggen</button>
        </p>
      ) : (
        <form onSubmit={signIn} style={{ display: "grid", gap: 12, maxWidth: 420, padding: 18, margin: "16px 0", background: "white", border: "1px solid #d8dee8", borderRadius: 10 }}>
          <h3 style={{ margin: 0 }}>Beheerderslogin</h3>
          <label style={labelStyle}>
            E-mailadres
            <input style={inputStyle} type="email" autoComplete="username" required value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
          </label>
          <label style={labelStyle}>
            Wachtwoord
            <input style={inputStyle} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" style={{ padding: 12, border: 0, borderRadius: 8, background: "#173f5f", color: "white", cursor: "pointer" }}>
            Inloggen
          </button>
          <p style={{ margin: 0, color: "#64748b" }}>Gebruik het wachtwoord van je Database 47-account.</p>
        </form>
      )}

      {isAdmin && <>
      <AnalyticsDashboard client={supabase} />
      <AdvertisingRequests client={supabase}/><ListingRequestsAdmin client={supabase}/><MailSettings client={supabase}/>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          margin: "20px 0",
        }}
      >
        {[
          ["Evenementen", events.length],
          ["Categorieën", categories.length],
          [
            "Wacht op controle",
            events.filter((event) => event.status?.toLowerCase() === "pending").length,
          ],
        ].map(([label, count]) => (
          <div
            key={String(label)}
            style={{
              padding: 16,
              background: "white",
              border: "1px solid #d8dee8",
              borderRadius: 10,
            }}
          >
            <div style={{ fontSize: 14, color: "#64748b" }}>{label}</div>
            <strong style={{ fontSize: 27 }}>{count}</strong>
          </div>
        ))}
      </div>

      <h2>Databaseverbinding</h2>
      <p>
        {supabase
          ? `${categories.length} categorieën en ${events.length} evenementen geladen.`
          : "Supabase-instellingen ontbreken."}
      </p>

      {error && (
        <p
          role="alert"
          style={{
            padding: 12,
            background: "#fff1f2",
            color: "#9f1239",
            borderRadius: 8,
            overflowWrap: "anywhere",
          }}
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          style={{
            padding: 12,
            background: "#ecfdf5",
            color: "#065f46",
            borderRadius: 8,
            overflowWrap: "anywhere",
          }}
        >
          {message}
        </p>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          margin: "24px 0",
        }}
      >
        <button
          type="button"
          onClick={openEventEntryForm}
          aria-controls="activity-tip-form"
          style={{
            padding: "12px 18px",
            border: 0,
            borderRadius: 8,
            background: "#173f5f",
            color: "white",
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          Een nieuw evenement/vermelding
        </button>

        <button
          type="button"
          onClick={() => void refreshStoredData()}
          disabled={refreshing||importLoading||importing}
          aria-busy={refreshing}
          style={{
            padding: "12px 18px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "white",
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          {refreshing?'Gegevens vernieuwen…':'Vernieuwen'}
        </button>
        {isAdmin && <>
          <button type="button" onClick={()=>void previewEventSource('all','Alle agendabronnen')} disabled={importLoading||importing} aria-busy={activeImport==='all'} style={{padding:'12px 18px',border:'1px solid #315c4b',borderRadius:8,background:'#315c4b',color:'white',fontSize:15}}>{activeImport==='all'?'Alle bronnen ophalen…':'Alles verversen'}</button>
          {IMPORT_SOURCES.map(source=><button key={source.endpoint} type="button" onClick={()=>void previewEventSource(source.endpoint,source.name)} disabled={importLoading||importing} aria-busy={activeImport===source.endpoint} style={{padding:'12px 18px',border:'1px solid #cbd5e1',borderRadius:8,background:'white',fontSize:15}}>{activeImport===source.endpoint?source.name+' ophalen…':source.name+' importeren'}</button>)}
          <p style={{width:'100%',margin:0}}>Vernieuwen laadt de opgeslagen gegevens opnieuw. Kies één import om alleen die bron op te halen. Alles verversen haalt alle agendabronnen op. Controleer daarna de voorvertoning voordat je de import opslaat.</p>
        </>}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setShowSocialPostForm((open) => !open);
              setSocialPostError("");
            }}
            disabled={importing}
            style={{ padding: "12px 18px", border: "1px solid #cbd5e1", borderRadius: 8, background: "white", cursor: importing ? "wait" : "pointer", fontSize: 15 }}
          >
            {showSocialPostForm ? "Sociale post sluiten" : "Sociale post voorvertonen"}
          </button>
        )}
      </div>

      {isAdmin && showSocialPostForm && (
        <section aria-label="Sociale post klaarzetten voor voorvertoning" style={{ display: "grid", gap: 14, margin: "18px 0 24px", padding: 20, border: "1px solid #d8dee8", borderRadius: 12, background: "#fff" }}>
          <div>
            <h3 style={{ margin: "0 0 8px" }}>Facebook- of Instagrambericht bekijken</h3>
            <p style={{ margin: 0, color: "#52616f", lineHeight: 1.55 }}>
              Plak de link en de tekst van één specifiek bericht. Besloten groepsberichten kunnen niet automatisch door de agenda worden uitgelezen; daarom lever je hier zelf het bericht aan. De app vraagt niet om je Facebook-wachtwoord en logt niet namens jou in. De datum kan uit de tekst worden voorgesteld, maar controleer datum en tijd altijd. De volledige berichttekst wordt als beschrijving opgeslagen. De foto verschijnt alleen als je ook een directe fotolink invult.
            </p>
          </div>
          <label style={labelStyle}>
            Link naar het oorspronkelijke bericht (niet alleen de groepslink) *
            <input style={inputStyle} type="url" value={socialPostUrl} onChange={(event) => setSocialPostUrl(event.target.value)} placeholder="https://www.facebook.com/groups/.../posts/..." />
            <span style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 13, fontWeight: 400 }}>Open een bericht in de groep en klik op de datum of tijd ervan om de link van dat bericht te kopiëren.</span>
          </label>
          <label style={labelStyle}>
            Berichttekst *
            <textarea style={{ ...inputStyle, minHeight: 130, resize: "vertical" }} value={socialPostText} onChange={(event) => setSocialPostText(event.target.value)} placeholder="Plak de tekst van het bericht hier" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label style={labelStyle}>
              Evenementtitel *
              <input style={inputStyle} maxLength={180} value={socialPostTitle} onChange={(event) => setSocialPostTitle(event.target.value)} placeholder="Titel zoals die in de agenda mag staan" />
            </label>
            <label style={labelStyle}>
              Plaats *
              <input style={inputStyle} value={socialPostCity} onChange={(event) => setSocialPostCity(event.target.value)} placeholder="Duras, Eymet, Marmande…" />
            </label>
            <label style={labelStyle}>
              Begindatum en -tijd *
              <input style={inputStyle} type="datetime-local" value={socialPostStartAt} onChange={(event) => setSocialPostStartAt(event.target.value)} />
            </label>
            <label style={labelStyle}>
              Einddatum en -tijd (optioneel)
              <input style={inputStyle} type="datetime-local" value={socialPostEndAt} onChange={(event) => setSocialPostEndAt(event.target.value)} />
            </label>
            <label style={labelStyle}>
              Locatie (optioneel)
              <input style={inputStyle} value={socialPostVenue} onChange={(event) => setSocialPostVenue(event.target.value)} placeholder="Bijvoorbeeld Salle des fêtes" />
            </label>
            <label style={labelStyle}>
              Fotolink (optioneel)
              <input style={inputStyle} type="url" value={socialPostImageUrl} onChange={(event) => setSocialPostImageUrl(event.target.value)} placeholder="https://…" />
            </label>
            <label style={labelStyle}>
              Categorie *
              <select style={inputStyle} value={socialPostCategoryId} onChange={(event) => setSocialPostCategoryId(event.target.value)}>
                <option value="">Kies een categorie</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name ?? category.slug ?? "Activiteit"}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                const detected = findSocialDateTime(socialPostText);
                if (detected) {
                  setSocialPostStartAt(detected);
                  setSocialPostError("");
                } else {
                  setSocialPostError("Ik kon geen duidelijke datum herkennen. Vul de datum en tijd zelf in.");
                }
              }}
              style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 7, background: "white" }}
            >
              Datum uit bericht halen
            </button>
            <button type="button" onClick={previewSocialPost} disabled={importing || categories.length === 0} style={{ padding: "10px 14px", border: 0, borderRadius: 7, background: "#173f5f", color: "white", cursor: importing ? "wait" : "pointer", fontWeight: 700 }}>
              Maak voorvertoning
            </button>
          </div>
          {categories.length === 0 && <p role="alert" style={{ margin: 0, color: "#9f1239" }}>De categorieën zijn nog niet geladen. Vernieuw de beheerderstool voordat je verdergaat.</p>}
          {socialPostError && <p role="alert" style={{ margin: 0, padding: 12, background: "#fff1f2", color: "#9f1239", borderRadius: 8 }}>{socialPostError}</p>}
        </section>
      )}

      {importNotice && (
        <section className="import-preview" aria-label={`Voorvertoning ${importSourceName}`}>
          <div className="import-preview-heading">
            <span className="import-preview-kicker">Importvoorvertoning</span>
            <h3>{importSourceName}</h3>
            <p role="status">{importNotice}</p>
            <p>Nieuwe activiteiten komen na import eerst in <strong>Wacht op controle</strong>. De bronlink blijft bewaard. Na import pas je per evenement de categorie aan met <strong>BEWERKEN</strong>.</p>
          </div>
          {categories.length === 0 && <p role="alert" style={{ color: "#9f1239" }}>Er zijn geen categorieën geladen. Importeer nog niet; de categorieën moeten eerst in deze database beschikbaar zijn.</p>}
          {importPreview.length > 0 && (
            <button
              type="button"
              onClick={() => void importTourismeDuras()}
              disabled={importing || !isAdmin || categories.length === 0}
              style={{ marginBottom: 14, padding: "12px 18px", border: 0, borderRadius: 8, background: importing ? "#94a3b8" : "#16734b", color: "white", cursor: importing ? "wait" : "pointer", fontSize: 15 }}
            >
              {importing ? "Importeren..." : `Importeer ${importPreview.length} activiteiten naar Wacht op controle`}
            </button>
          )}
          <div className="import-preview-list">
            {importPreview.slice(0, importPreviewLimit).map((event) => (
              <article className="import-event-card" key={event.source_url}>
                {safeHttpUrl(event.image_url) ? <img className="import-event-image" src={safeHttpUrl(event.image_url)!} alt={`Foto bij ${event.title}`} loading="lazy" /> : <div className="import-event-image import-event-image-placeholder" aria-label="Geen evenementfoto op de beschikbare bronpagina"><span>Foto niet gevonden</span></div>}
                <div className="import-event-content">
                  <div className="import-event-topline"><span className="import-status-pill">Voorbeeld — nog niet opgeslagen</span>{event.source_category && <span className="import-source-category">{event.source_category}</span>}</div>
                  <h4>{event.title}</h4>
                  <p className="import-event-date">{formatDate(event.start_at)}{event.end_at ? ` t/m ${formatDate(event.end_at)}` : ""}</p>
                  <p className="import-event-place">{[event.venue_name, event.address, event.postcode, event.city].filter(Boolean).join(", ") || event.city || "Adres niet op de bronpagina gevonden"}</p>
                  {(event.short_description || event.description) && <p className="import-event-description">{event.short_description || event.description}</p>}
                  <div className="import-event-meta">
                    {event.contact_phone && <span>Tel. {event.contact_phone}</span>}
                    {safeHttpUrl(event.website_url) && <a data-analytics-channel="website" href={safeHttpUrl(event.website_url)!} target="_blank" rel="noreferrer">{event.source_url.includes("eymet-dordogne.fr") ? "Aanvullende evenementpagina" : "Website organisator"}</a>}
                    {safeHttpUrl(event.booking_url) && <a data-analytics-channel="booking" href={safeHttpUrl(event.booking_url)!} target="_blank" rel="noreferrer">Reserveren</a>}
                  </div>
                  <p className="import-category-suggestion"><strong>Voorgestelde categorie:</strong> {categories.find((category) => category.id === event.category_id)?.name ?? "Nog te bepalen"}. Je kunt deze na import wijzigen via BEWERKEN.</p>
                  <a className="import-source-link" href={event.source_url} target="_blank" rel="noreferrer">Oorspronkelijke bron bekijken ↗ <span>{sourceLabel(event.source_url)}</span></a>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {importPreview.length > importPreviewLimit && <button type="button" onClick={() => setImportPreviewLimit(count => count + 60)}>Toon meer importvoorbeelden ({importPreview.length - importPreviewLimit} resterend)</button>}
      <h2 id="admin-results-heading">Evenementen beheren</h2>

      {(() => {
        const pendingEvents = events.filter((event) => event.status?.toLowerCase() === "pending");
        const pendingImportCount=events.filter(isPendingImport).length;
        const results=searchAdminEvents(events,adminEventSearch,adminCategoryFilter,adminEventFilter,adminEventPage);
        return <>
          <div role="group" aria-label="Filter evenementen" style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "12px 0 18px" }}>
            <button
              type="button"
              aria-pressed={adminEventFilter === "pending"}
              onClick={() => { setAdminEventFilter("pending"); setAdminEventPage(1); }}
              style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 7, background: adminEventFilter === "pending" ? "#173f5f" : "white", color: adminEventFilter === "pending" ? "white" : "#172033", cursor: "pointer", fontWeight: 700 }}
            >
              Wacht op controle ({pendingEvents.length})
            </button>
            <button
              type="button"
              aria-pressed={adminEventFilter === "all"}
              onClick={() => { setAdminEventFilter("all"); setAdminEventPage(1); }}
              style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 7, background: adminEventFilter === "all" ? "#173f5f" : "white", color: adminEventFilter === "all" ? "white" : "#172033", cursor: "pointer", fontWeight: 700 }}
            >
              Alle evenementen ({events.length})
            </button>
          </div>
          <div style={{padding:14,marginBottom:16,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8}}>
            <button type="button" disabled={loading||bulkApproving||importing||updatingEventId!==null||pendingImportCount===0} onClick={()=>void approveAllImports()} style={{padding:'10px 14px',border:0,borderRadius:7,background:'#16734b',color:'white',fontWeight:700}}>{bulkApproving?'Imports worden goedgekeurd…':`Alle imports goedkeuren (${pendingImportCount})`}</button>
            <p style={{margin:'8px 0 0'}}>Keur alle wachtende imports goed, in alle categorieën en op alle pagina’s. De vermeldingen worden openbaar zichtbaar. Handmatige inzendingen blijven apart ter controle.</p>
            {bulkApprovalNotice&&<p role="status" aria-live="polite">{bulkApprovalNotice}</p>}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:14,alignItems:'end',marginBottom:16}}>
            <label style={{...labelStyle,flex:'1 1 240px'}}>Zoek op naam
              <input type="search" style={inputStyle} value={adminEventSearch} placeholder="Bijvoorbeeld Château of Café de la place" onChange={e=>{setAdminEventSearch(e.target.value);setAdminEventPage(1);}} />
            </label>
            <label style={{...labelStyle,flex:'1 1 240px'}}>Categorie in beheer
              <select style={inputStyle} value={adminCategoryFilter} onChange={e=>{setAdminCategoryFilter(e.target.value);setAdminEventPage(1);}}>
                <option value="all">Alle categorieën</option><option value="none">Nog niet ingedeeld</option>
                {categories.map(category=><option key={category.id} value={category.id}>{category.name??category.slug}</option>)}
              </select>
            </label>
            <button type="button" onClick={()=>{setAdminEventSearch('');setAdminCategoryFilter('all');setAdminEventPage(1);}}>Zoekfilters wissen</button>
          </div>
          {!loading&&<p role="status" aria-live="polite">{results.total} {results.total===1?'resultaat':'resultaten'} · {results.total?`${results.from}–${results.to} getoond · pagina ${results.page} van ${results.pages}`:'pas de naam, categorie of status aan'}</p>}
          {!loading && results.total === 0 && (
            <p role="status" style={{ padding: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534" }}>
              Geen vermeldingen gevonden met deze combinatie van naam, categorie en status.
            </p>
          )}

      {loading && <p>Gegevens laden...</p>}

      {!loading && events.length === 0 && (
        <p>Er zijn nog geen evenementen opgeslagen.</p>
      )}

      {results.items.map((event) => (
        <article
          key={event.id}
          style={{
            padding: 16,
            marginBottom: 12,
            background: "white",
            border: "1px solid #d8dee8",
            borderRadius: 10,
            overflowWrap: "anywhere",
          }}
        >
          <h3>{event.title}</h3>
          {savedEventId === event.id && editingEventId !== event.id && (
            <p role="status" aria-live="polite" style={{ padding: 10, background: "#ecfdf5", color: "#065f46", borderRadius: 8 }}>
              Wijzigingen opgeslagen. Het bewerkingsvenster is gesloten.
            </p>
          )}
          {safeHttpUrl(event.image_url) && <img src={safeHttpUrl(event.image_url)!} alt={event.title} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 8, marginBottom: 12 }} />}
          <p><strong>Categorie:</strong> {event.category_ids?.map(id=>categories.find(c=>c.id===id)?.name).filter(Boolean).join(', ') || event.category_name || "Nog niet ingedeeld"}</p>
          <p>{formatDate(event.start_at)}{event.end_at ? ` t/m ${formatDate(event.end_at)}` : ""}</p>
          {(event.venue_name || event.address || event.postcode || event.city) && (
            <p>{[event.venue_name, event.address, event.postcode, event.city].filter(Boolean).join(", ")}</p>
          )}
          {event.contact_phone && <p>Telefoon: <a href={`tel:${event.contact_phone.replace(/[^+\d]/g, "")}`}>{event.contact_phone}</a></p>}
          {event.is_manual_entry && <div><button type="button" onClick={()=>void createOwnerLink(event)}>Persoonlijke beheerlink voor inzender maken</button>{managementLink.includes(event.id+":")&&<label>Alleen delen met de geverifieerde inzender<input style={inputStyle} readOnly value={managementLink} onFocus={e=>e.target.select()}/></label>}</div>}
          {safeHttpUrl(event.website_url) && <p><a data-analytics-channel="website" href={safeHttpUrl(event.website_url)!} target="_blank" rel="noreferrer">Website</a></p>}
          {safeHttpUrl(event.booking_url) && <p><a data-analytics-channel="booking" href={safeHttpUrl(event.booking_url)!} target="_blank" rel="noreferrer">Reserveren</a></p>}
          {event.source_category && <p>Type bij bron: {event.source_category}</p>}
          {event.organizer_name && <p>Organisator: {event.organizer_name}</p>}
          {event.source_url && <p>Bron: {sourceLabel(event.source_url)}</p>}
          {safeHttpUrl(event.source_url) && <p><a data-analytics-channel="source" href={safeHttpUrl(event.source_url)!} target="_blank" rel="noreferrer">Bronpagina</a></p>}
          {event.short_description && <p>{event.short_description}</p>}
          {event.description && <p>{event.description}</p>}
          <p>
            Status:{" "}
            {event.status === "pending"
              ? "In afwachting van controle"
              : event.status === "rejected"
                ? "Afgewezen"
              : event.status ?? "Onbekend"}
          </p>
          {event.promotion_type && event.promotion_type !== "none" && <div className="admin-promotion-request">
            <p><strong>Promotieaanvraag:</strong> {event.promotion_type === "homepage" ? "Homepage" : event.promotion_type === "category" ? "Categorie" : "Omkaderde vermelding"} · {event.promotion_status === "active" ? "actief" : event.promotion_status === "ended" ? "beëindigd" : "wacht op betaling/controle"}</p>
            {event.advertiser_email && <p>Contact adverteerder: <a href={`mailto:${event.advertiser_email}`}>{event.advertiser_email}</a></p>}
            {isAdmin && event.promotion_status !== "active" && event.promotion_status !== "ended" && event.status === "approved" && event.verified === true && <button type="button" disabled={bulkApproving || updatingEventId === event.id} onClick={() => void setPromotionStatus(event, "active")}>Activeer na betaalbevestiging</button>}
            {isAdmin && event.promotion_status !== "active" && event.promotion_status !== "ended" && (event.status !== "approved" || event.verified !== true) && <p>Keur het evenement eerst goed en bevestig de betaling voordat je de promotie activeert.</p>}
            {isAdmin && event.promotion_status === "active" && <button type="button" disabled={bulkApproving || updatingEventId === event.id} onClick={() => void setPromotionStatus(event, "ended")}>Promotie stoppen</button>}
          </div>}

          {isAdmin && editingEventId !== event.id && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button type="button" disabled={bulkApproving} onClick={() => beginEdit(event)} style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 7, background: "white", cursor: "pointer" }}>
                BEWERKEN
              </button>
              {event.status?.toLowerCase() === "pending" && <button
                type="button"
                disabled={bulkApproving || updatingEventId === event.id}
                onClick={() => void setEventStatus(event, "approved")}
                style={{ padding: "10px 14px", border: 0, borderRadius: 7, background: updatingEventId === event.id ? "#94a3b8" : "#16734b", color: "white", cursor: updatingEventId === event.id ? "wait" : "pointer" }}
              >
                {updatingEventId === event.id ? "Bezig..." : "GOEDKEUREN"}
              </button>}
              <button
                type="button"
                disabled={bulkApproving || updatingEventId === event.id}
                onClick={() => void deleteEvent(event)}
                style={{ padding: "10px 14px", border: "1px solid #fecaca", borderRadius: 7, background: "white", color: "#b91c1c", cursor: updatingEventId === event.id ? "wait" : "pointer" }}
              >
                {updatingEventId === event.id ? "Verwijderen…" : "VERWIJDEREN"}
              </button>
            </div>
          )}
           
          {event.is_free ? (
            <p>Gratis</p>
          ) : event.price_from != null ? (
            <p>
              Vanaf €{Number(event.price_from).toFixed(2)}
              {event.price_to != null
                ? ` tot €${Number(event.price_to).toFixed(2)}`
                : ""}
            </p>
          
          ) : null}

          {isAdmin && editingEventId === event.id && editDraft && (
            <form
              onSubmit={(e) => void saveEventEdits(e, event)}
              style={{
                display: "grid",
                gap: 14,
                marginTop: 18,
                padding: 18,
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: 10,
              }}
            >
              <h3 style={{ margin: 0 }}>Evenement bewerken</h3>

              <label style={labelStyle}>
                Titel *
                <input
                  style={inputStyle}
                  required
                  value={editDraft.title}
                  onChange={(e) => updateEditDraft("title", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Categorie
                <select
                  style={inputStyle}
                  value={editDraft.category_id}
                  onChange={(e) => updateEditDraft("category_id", e.target.value)}
                  disabled={categories.length === 0}
                >
                  <option value="">Kies een categorie</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name ?? category.slug ?? "Categorie"}</option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                Korte beschrijving
                <input
                  style={inputStyle}
                  maxLength={250}
                  value={editDraft.short_description}
                  onChange={(e) => updateEditDraft("short_description", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Uitgebreide beschrijving
                <textarea
                  style={{ ...inputStyle, minHeight: 100 }}
                  value={editDraft.description}
                  onChange={(e) => updateEditDraft("description", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Foto van het evenement
                {safeHttpUrl(event.image_url) && !editPhotoPreview && (
                  <img src={safeHttpUrl(event.image_url)!} alt={`Huidige foto bij ${event.title}`} loading="lazy" style={{ display: "block", width: "min(100%, 360px)", maxHeight: 240, objectFit: "cover", borderRadius: 8, margin: "8px 0" }} />
                )}
                <input
                  style={inputStyle}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file && file.size > MAX_VISITOR_PHOTO_BYTES) {
                      setEditPhotoFile(null);
                      setEditError("De foto moet kleiner zijn dan 5 MB.");
                      e.target.value = "";
                      return;
                    }
                    if (file && !eventPhotoType(file)) {
                      setEditPhotoFile(null);
                      setEditError("Kies een JPG-, PNG- of WebP-foto.");
                      e.target.value = "";
                      return;
                    }
                    setEditError("");
                    setEditPhotoFile(file);
                  }}
                />
                <span style={{ display: "block", marginTop: 6, color: "#64748b", fontWeight: 400 }}>Kies een JPG-, PNG- of WebP-foto van maximaal 5 MB. Een nieuwe foto vervangt de huidige foto.</span>
                {editPhotoPreview && <img src={editPhotoPreview} alt="Voorbeeld van de nieuwe evenementfoto" style={{ display: "block", width: "min(100%, 360px)", maxHeight: 240, objectFit: "cover", borderRadius: 8, marginTop: 10 }} />}
              </label>

              <label style={labelStyle}>
                {event.is_directory_entry?'Vaste vermelding — geen evenementdatum':'Begindatum en -tijd *'}
                <input
                  style={inputStyle}
                  type="datetime-local"
                  required
                  disabled={event.is_directory_entry}
                  value={editDraft.start_at}
                  onChange={(e) => updateEditDraft("start_at", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Einddatum en -tijd
                <input
                  style={inputStyle}
                  type="datetime-local"
                  disabled={event.is_directory_entry}
                  value={editDraft.end_at}
                  onChange={(e) => updateEditDraft("end_at", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Locatie / zaal
                <input
                  style={inputStyle}
                  value={editDraft.venue_name}
                  onChange={(e) => updateEditDraft("venue_name", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Adres
                <input
                  style={inputStyle}
                  value={editDraft.address}
                  onChange={(e) => updateEditDraft("address", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Postcode
                <input
                  style={inputStyle}
                  value={editDraft.postcode}
                  onChange={(e) => updateEditDraft("postcode", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Plaats
                <input
                  style={inputStyle}
                  value={editDraft.city}
                  onChange={(e) => updateEditDraft("city", e.target.value)}
                />
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={editDraft.is_free}
                  onChange={(e) => updateEditDraft("is_free", e.target.checked)}
                />
                Dit evenement is gratis
              </label>

              {!editDraft.is_free && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 12,
                  }}
                >
                  <label style={labelStyle}>
                    Prijs vanaf (€)
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDraft.price_from}
                      onChange={(e) => updateEditDraft("price_from", e.target.value)}
                    />
                  </label>
                  <label style={labelStyle}>
                    Prijs tot (€)
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDraft.price_to}
                      onChange={(e) => updateEditDraft("price_to", e.target.value)}
                    />
                  </label>
                </div>
              )}

              <label style={labelStyle}>
                Website
                <input
                  style={inputStyle}
                  type="text"
                  inputMode="url"
                  value={editDraft.website_url}
                  onChange={(e) => updateEditDraft("website_url", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Reserveringslink
                <input
                  style={inputStyle}
                  type="text"
                  inputMode="url"
                  value={editDraft.booking_url}
                  onChange={(e) => updateEditDraft("booking_url", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Bronlink
                <input
                  style={inputStyle}
                  type="text"
                  inputMode="url"
                  value={editDraft.source_url}
                  onChange={(e) => updateEditDraft("source_url", e.target.value)}
                />
              </label>

              {editError && (
                <p role="alert" aria-live="assertive" style={{ margin: 0, padding: 12, background: "#fff1f2", color: "#9f1239", borderRadius: 8, overflowWrap: "anywhere" }}>
                  {editError}
                </p>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button
                  type="submit"
                  disabled={bulkApproving || updatingEventId === event.id}
                  style={{
                    padding: "11px 16px",
                    border: 0,
                    borderRadius: 7,
                    background: updatingEventId === event.id ? "#94a3b8" : "#16734b",
                    color: "white",
                    cursor: updatingEventId === event.id ? "wait" : "pointer",
                  }}
                >
                  {updatingEventId === event.id ? "Opslaan..." : "Wijzigingen opslaan"}
                </button>
                <button
                  type="button"
                  disabled={bulkApproving || updatingEventId === event.id}
                  onClick={() => {
                    setEditingEventId(null);
                    setEditDraft(null);
                    setEditPhotoFile(null);
                    setEditError("");
                    setError("");
                  }}
                  style={{
                    padding: "11px 16px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 7,
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Annuleren
                </button>
              </div>
            </form>
          )}
        </article>

      ))}
          {results.pages>1&&<nav aria-label="Pagina’s beheerresultaten" style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',margin:'20px 0'}}>
            <button type="button" disabled={results.page<=1} onClick={()=>{setAdminEventPage(results.page-1);document.getElementById('admin-results-heading')?.scrollIntoView({behavior:'smooth'});}}>Vorige pagina</button>
            <span>Pagina {results.page} van {results.pages}</span>
            <button type="button" disabled={results.page>=results.pages} onClick={()=>{setAdminEventPage(results.page+1);document.getElementById('admin-results-heading')?.scrollIntoView({behavior:'smooth'});}}>Volgende pagina</button>
          </nav>}
        </>;
      })()}
      </>}
      </>}
      </details>
      {selectedVisitorEvent && typeof document !== "undefined" && createPortal(
        <div className="event-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeVisitorEvent(); }}>
          <section data-analytics-event={selectedVisitorEvent.id} data-analytics-placement={visitorEventPlacement} className="event-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="visitor-event-title" tabIndex={-1}>
            <div className="event-detail-topbar">
              <button className="event-detail-back" type="button" autoFocus onClick={closeVisitorEvent}><span aria-hidden="true">←</span> Terug naar de agenda</button>
              <button className="event-detail-close" type="button" aria-label="Sluiten" onClick={closeVisitorEvent}>×</button>
            </div>
            {safeHttpUrl(selectedVisitorEvent.image_url) && <img className="event-detail-image" src={safeHttpUrl(selectedVisitorEvent.image_url)!} alt="" />}
            <div className="event-detail-content">
              <p className="event-detail-kicker">{categories.find((category) => category.id === selectedVisitorEvent.category_id)?.name ?? "Activiteit in de streek"}</p>
              <h2 id="visitor-event-title">{selectedVisitorEvent.title}</h2>
              <p className="event-detail-date">{formatDate(selectedVisitorEvent.start_at)}{selectedVisitorEvent.end_at ? ` – ${formatDate(selectedVisitorEvent.end_at)}` : ""}</p>
              <p className="event-detail-place">{[selectedVisitorEvent.venue_name, selectedVisitorEvent.address, selectedVisitorEvent.postcode, selectedVisitorEvent.city].filter(Boolean).join(", ") || selectedVisitorEvent.city || "Lot-et-Garonne"}</p>
              {(selectedVisitorEvent.short_description || selectedVisitorEvent.description) && <p className="event-detail-description">{selectedVisitorEvent.description || selectedVisitorEvent.short_description}</p>}
              {selectedVisitorEvent.is_free ? <p className="event-detail-price">Gratis</p> : selectedVisitorEvent.price_from != null ? <p className="event-detail-price">Vanaf €{Number(selectedVisitorEvent.price_from).toFixed(2)}{selectedVisitorEvent.price_to != null ? ` tot €${Number(selectedVisitorEvent.price_to).toFixed(2)}` : ""}</p> : null}
              <div className="event-detail-links">
                {safeHttpUrl(selectedVisitorEvent.booking_url) && <a className="event-detail-primary" data-analytics-channel="booking" href={safeHttpUrl(selectedVisitorEvent.booking_url)!} target="_blank" rel="noopener noreferrer">Reserveren <span aria-hidden="true">↗</span></a>}
                {safeHttpUrl(selectedVisitorEvent.website_url) && <a data-analytics-channel="website" href={safeHttpUrl(selectedVisitorEvent.website_url)!} target="_blank" rel="noopener noreferrer">Website organisator <span aria-hidden="true">↗</span></a>}
                {safeHttpUrl(selectedVisitorEvent.source_url) && <a data-analytics-channel="source" href={safeHttpUrl(selectedVisitorEvent.source_url)!} target="_blank" rel="noopener noreferrer">Oorspronkelijke informatie <span aria-hidden="true">↗</span></a>}
              </div>
              <p className="event-detail-note">Externe pagina’s openen in een nieuw tabblad. Je kunt hierna direct terug naar de agenda.</p>
              {selectedVisitorEvent.source_url && <p className="activity-source">Bron: {sourceLabel(selectedVisitorEvent.source_url)}</p>}
              <ListingRequestForm key={selectedVisitorEvent.id} eventId={selectedVisitorEvent.id} title={selectedVisitorEvent.title}/><button className="event-detail-back event-detail-back-bottom" type="button" onClick={closeVisitorEvent}><span aria-hidden="true">←</span> Terug naar de agenda</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </main>
  );
}




