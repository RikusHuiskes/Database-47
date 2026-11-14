"use client";
import {T, A, useLanguage} from './i18n/Language';

import {publicEventUrl} from '../lib/public-event-links';
import {intlLocale,localizeMunicipalName} from '../lib/i18n';


import EventImage from './components/EventImage';
import MunicipalServicePhoto from './components/MunicipalServicePhoto';
import MunicipalBusinessAdmin from './components/MunicipalBusinessAdmin';
import MunicipalPartners from './components/MunicipalPartners';
import CalendarSiteSwitcher from './components/CalendarSiteSwitcher';
import {SHOP_TYPES,COMMERCIAL_SERVICE_TYPES} from "../lib/municipal-shops";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {IMPORT_SOURCES,ALL_IMPORT_SOURCES,fetchImportPreview} from '../lib/admin-import-sources';
import FloatingPromotions from './components/FloatingPromotions';
import PaidListingsCarousel from './components/PaidListingsCarousel';
import CoteDeDurasAdvertisement from './components/CoteDeDurasAdvertisement';
import AdvertiserFields from "./components/AdvertiserFields";
import EventAdvertisingExamples from "./components/EventAdvertisingExamples";
import NewEventExperience from "./components/NewEventExperience";
import entry from "./components/new-event-experience.module.css";
import {MONTHLY_PRICES,advertisingSelectionQuote,emptyAdvertiser,validateAdvertiser,type AdvertisingType} from "../lib/advertising";
import {advertisingPlacementName,formatAdvertisingAmount,requestListingCheckout,type ListingPaymentSummary} from "../lib/listing-checkout";
import AnalyticsConsent from "./components/AnalyticsConsent";
import MailSettings from './components/MailSettings';
import SocialLinks from './components/SocialLinks';
import ListingRequestsAdmin from './components/ListingRequestsAdmin';
import AdvertisingRequests from "./components/AdvertisingRequests";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import {trackAnalytics} from "../lib/analytics-client";
import {upcomingHighlights,promotionPlacements,uniqueEventRecords,promotionIsActive,hasActiveAdvertising,hasAdvertisingPlacement,prioritizeHighlighted} from "../lib/event-presentation";
import {normalizeWebAddress} from "../lib/web-address";
import {visitorLocationDecision,shouldUseTownFallback} from '../lib/visitor-location';
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
import { categoryIdsForSelection, DEFAULT_SEARCH_RADIUS_KM, eventDateFilter, matchesEventDateRange, matchesSelectedCategory, SEARCH_RADIUS_OPTIONS } from "../lib/nearby-search";
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
  advertising_placements?:{placement:string;starts_at:string;ends_at:string}[]|null;
  promotion_type?: "none" | "homepage" | "category" | "highlight" | null;
  promotion_status?: "none" | "requested" | "active" | "ended" | null;
  promotion_start_at?:string|null;
  promotion_end_at?:string|null;
  advertiser_email?: string | null;
  reserved_homepage?:boolean;
  reserved_category_id?:string|null;
};

type LocalAreaOption = Omit<LocalAreaTown, "latitude" | "longitude"> & { latitude: number | null; longitude: number | null; distance_group?: string };
type NearbyEvent = EventRow & { distance_km: number; distance_is_approximate: boolean };
type MunicipalityServiceType = "all" | "mairie" | "doctor" | "hospital" | "library" | "pharmacy" | "church" | "tourism" | "emergency" | "dentist" | "physiotherapist" | "psychologist" | "supermarket" | "fuel" | "charging" | "public_transport" | "parking" | "disabled_parking" | "bakery" | "butcher" | "tobacco" | "souvenirs" | "shoes" | "florist" | "fashion" | "diy" | "jeweller" | "hairdresser" | "estate_agent";
type MunicipalityServiceEntry = {
  hasActiveAdvertising?:boolean; highlighted?:boolean; image_url?:string; image_source_url?:string; image_credit?:string; image_license?:string; image_license_url?:string; managedEventId?:string;
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
  municipalPartners?:import('../lib/municipal-advertising-server').MunicipalPaidListing[];
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
  { id: "estate_agent", label:"Makelaars" },
  { id: "all", label: "Alle categorieën — complete gemeentegids" },
  { id: "mairie", label: "Gemeentehuis & burgemeester" },
  { id: "doctor", label: "Huisarts / medisch centrum" },
  { id: "hospital", label: "Dichtstbijzijnde ziekenhuis" },
  { id: "library", label: "Bibliotheek" },
  { id: "pharmacy", label: "Apotheek" },
  { id: "church", label: "Kerk & mis- of diensttijden" },
  { id: "tourism", label: "Office de tourisme" },
  { id: "dentist", label: "Tandarts" },
  { id: "physiotherapist", label: "Fysiotherapie" },
  { id: "psychologist", label: "Psychologische dienstverlening" },
  { id: "supermarket", label: "Supermarkten" },
  { id: "fuel", label: "Tankstations" },
  { id: "charging", label: "Laadpalen voor elektrische voertuigen" },
  { id: "public_transport", label: "Openbaar vervoer" },
  { id: "parking", label: "Parkeren" },
  { id: "disabled_parking", label: "Invalide parkeerplaatsen" },
  { id: "emergency", label: "Noodnummers" },
  { id: "bakery", label: "Bakkerij" },
  { id: "butcher", label: "Slagerij" },
  { id: "tobacco", label: "Tabak / Kiosk" },
  { id: "souvenirs", label: "Souvenirswinkel" },
  { id: "shoes", label: "Schoenenwinkel" },
  { id: "florist", label: "Bloemist" },
  { id: "fashion", label: "Mode" },
  { id: "diy", label: "Bouwmarkten" },
  { id: "jeweller", label: "Juwelier" },
  { id: "hairdresser", label: "Kapper" },
];

municipalityServiceOptions.sort((a,b)=>a.id==="all"?-1:b.id==="all"?1:a.label.localeCompare(b.label,"nl",{sensitivity:"base"}));

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

export default function DurasSite({newListingOnly=false,previewAdSamplesEnabled=false}:{newListingOnly?:boolean;previewAdSamplesEnabled?:boolean}) {
  const {locale,t}=useLanguage();
  const [localAreas, setLocalAreas] = useState<LocalAreaOption[]>([]);
  const [municipalityInView,setMunicipalityInView]=useState(false);
  useEffect(()=>{const node=document.getElementById('gemeenten');if(!node)return;const observer=new IntersectionObserver(entries=>setMunicipalityInView(entries[0]?.isIntersecting||false));observer.observe(node);return()=>observer.disconnect();},[]);
  const [municipalityAreaId, setMunicipalityAreaId] = useState("duras");
  const [municipalityServiceType, setMunicipalityServiceType] = useState<MunicipalityServiceType>("all");
  const [municipalityServiceInfo, setMunicipalityServiceInfo] = useState<MunicipalityServiceResponse | null>(null);
  const [municipalitySearchComplete, setMunicipalitySearchComplete] = useState(false);
  const [municipalityServicesLoading, setMunicipalityServicesLoading] = useState(false);
  const [municipalityServicesError, setMunicipalityServicesError] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState("duras");
  const deferredSelectedAreaId = useDeferredValue(selectedAreaId);
  const [visitorLocation, setVisitorLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationNotice,setLocationNotice]=useState('');
  const [locating,setLocating]=useState(false);
  const locationRequest=useRef(0);
  const deferredVisitorLocation = useDeferredValue(visitorLocation);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_SEARCH_RADIUS_KM);
  const [eventDateFrom, setEventDateFrom] = useState("");
  const [eventDateTo, setEventDateTo] = useState("");
  const dateFilter = useMemo(() => eventDateFilter(eventDateFrom, eventDateTo), [eventDateFrom, eventDateTo]);
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
  const [submissionPayment, setSubmissionPayment] = useState<(ListingPaymentSummary & { title: string; manageFragment: string }) | null>(null);
  const [checkoutStarting, setCheckoutStarting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const checkoutInFlight = useRef(false);
  useEffect(() => {
    const restoreCheckout = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkoutInFlight.current = false;
        setCheckoutStarting(false);
      }
    };
    window.addEventListener('pageshow', restoreCheckout);
    return () => window.removeEventListener('pageshow', restoreCheckout);
  }, []);
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
  const [bulkApprovalError,setBulkApprovalError]=useState('');
  const [bulkApprovalCandidates,setBulkApprovalCandidates]=useState<EventRow[]|null>(null);
  const bulkApprovalInFlight=useRef(false);
  const bulkApprovalCancel=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(bulkApprovalCandidates)bulkApprovalCancel.current?.focus();},[bulkApprovalCandidates]);
  const [adminEventSearch,setAdminEventSearch]=useState('');
  const [adminCategoryFilter,setAdminCategoryFilter]=useState('all');
  const [adminContentMounted, setAdminContentMounted] = useState(false);
  const [editDraft, setEditDraft] = useState<EventEditDraft | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState("");
  const [showForm, setShowForm] = useState(newListingOnly);
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
  const [ownerEmail, setOwnerEmail] = useState("");
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
  const [promotionTypes,setPromotionTypes] = useState<AdvertisingType[]>([]);
  const promotionType=promotionTypes[0]??"none";
  const promotionNames=promotionTypes.map(advertisingPlacementName).join(" + ");
  const [advertiser,setAdvertiser] = useState({...emptyAdvertiser});
  const promotionAmount=promotionTypes.reduce((sum,type)=>sum+MONTHLY_PRICES[type]*advertiser.months,0);
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
    return alphabeticalPlaces(areaOptions).map(area => <option key={area.id} value={area.id} disabled={area.latitude == null || area.longitude == null}><T>{area.name}</T></option>);
  }

  useEffect(() => {
    const openAdministration = () => {
      if (window.location.hash !== '#beheer') return;
      const panel = document.getElementById('beheer') as HTMLDetailsElement | null;
      if (panel) { panel.open = true; setAdminContentMounted(true); panel.scrollIntoView({block:'start'}); }
    };
    openAdministration();
    window.addEventListener('hashchange', openAdministration);
    return () => window.removeEventListener('hashchange', openAdministration);
  }, []);

  function openVisitorEvent(event: EventRow, placement = "standard") {
    setVisitorEventPlacement(placement);
    const route = `#activiteit/${encodeURIComponent(event.id)}`;
    window.history.pushState({ visitorEventId: event.id }, "", route);
    setSelectedVisitorEvent(event);
  }

  function closeVisitorEvent() {
    if (window.location.hash.startsWith("#activiteit/")) {
      if (window.history.state?.visitorEventId) window.history.back();
      else window.history.replaceState(window.history.state, "", "#agenda");
    }
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
    if (dateFilter.error) return [];
    return prioritizeHighlighted(uniqueEventRecords(nearbyEvents).map(event=>({...event,promotion_status:event.promotion_status==='active'&&!promotionIsActive(event)?'none' as const:event.promotion_status})).filter((event) => {
    const matchesCategory = matchesSelectedCategory(event.category_ids, categoryFilter);
    return matchesEventDateRange(event, dateFilter.range) && matchesCategory && (!freeOnly || event.is_free === true);
    }));
  }, [nearbyEvents, dateFilter, categoryFilter, freeOnly,promotionClock]);
  const placements = useMemo(() => promotionPlacements([...homepagePromotions,...categoryPromotions], categoryFilter), [categoryFilter,homepagePromotions,categoryPromotions,promotionClock]);
  const categoryPromotionEvents = placements.category;
  // Advertising adds visibility without removing a listing from normal search results.
  const standardNearbyEvents = visibleNearbyEvents;
  const displayedNearbyEvents = useMemo(
    () => standardNearbyEvents.slice(0, visibleEventCount),
    [standardNearbyEvents, visibleEventCount]
  );

  useEffect(() => {
    setVisibleEventCount(18);
  }, [selectedAreaId, visitorLocation, radiusKm, eventDateFrom, eventDateTo, categoryFilter, freeOnly, nearbyEvents]);

  useEffect(() => {
    if(newListingOnly)return;
    if (dateFilter.error) {
      setNearbyLoading(false);
      setNearbyError("");
      setNearbyEvents([]);
      return;
    }
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
    setNearbyEvents([]);
    const params = new URLSearchParams({
      lat: String(searchLatitude),
      lon: String(searchLongitude),
      radius: String(radiusKm),
      category: categoryFilter,
      date_from: eventDateFrom,
      date_to: eventDateTo,
    });
    void fetch(`/api/nearby-events?${params}&lang=source`, {signal: controller.signal})
      .then(async (response) => {
        const result = await readApiJson<{ events?: NearbyEvent[]; homepage_promotions?: EventRow[]; category_promotions?: EventRow[]; error?: string; locationless_count?: number }>(response);
        if (!response.ok) throw new Error(result.error ?? "Evenementen konden niet worden geladen.");
        return result;
      })
      .then((result) => {
        if (!active) return;
        const ordinaryCount=(result.events??[]).length;
        if(!dateFilter.range && shouldUseTownFallback(!!deferredVisitorLocation,ordinaryCount)){
          setVisitorLocation(null);
          setLocationNotice(`Binnen ${radiusKm} km van je huidige locatie zijn geen vermeldingen gevonden voor deze categorie. We zoeken daarom rond ${searchArea?.name??'Duras'}, met dezelfde afstand en categorie.`);
          return;
        }
        setNearbyEvents(result.events ?? []);
        setLocationlessCount(Number(result.locationless_count ?? 0));
      })
      .catch((cause) => {
        if (active) setNearbyError(cause instanceof Error ? cause.message : "Evenementen konden niet worden geladen.");
      })
      .finally(() => { if (active) setNearbyLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [newListingOnly,localAreas.length, searchLatitude, searchLongitude, radiusKm,categoryFilter,dataRevision,eventDateFrom,eventDateTo,dateFilter]);

  // Paid placements load independently of ordinary search and geocoding.
  useEffect(() => {
    if(newListingOnly)return;
    const controller=new AbortController();
    let active=true;
    void fetch('/api/promotions?'+new URLSearchParams({category:categoryFilter,lang:"source"}),{signal:controller.signal})
      .then(async response=>{
        const result=await readApiJson<{homepage_promotions?:EventRow[];category_promotions?:EventRow[];error?:string}>(response);
        if(!response.ok)throw new Error(result.error??'Advertenties konden niet worden geladen.');
        return result;
      })
      .then(result=>{if(active){setHomepagePromotions(result.homepage_promotions??[]);setCategoryPromotions(result.category_promotions??[]);}})
      .catch(()=>{ /* Preserve loaded placements during a temporary connection failure. */ });
    return()=>{active=false;controller.abort();};
  },[categoryFilter,dataRevision,locale]);

  function useCurrentLocation() {
    const request=++locationRequest.current;
    setLocationNotice('');
    if (!navigator.geolocation) {
      setVisitorLocation(null);
      setLocationNotice(`Deze browser kan je locatie niet bepalen. Je zoekt daarom rond ${selectedArea?.name??'Duras'}.`);
      return;
    }
    setNearbyError("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if(request!==locationRequest.current)return;
        setLocating(false);
        const decision=visitorLocationDecision(position.coords,areaOptions);
        setVisitorLocation(decision.location);
        if(decision.reason)setLocationNotice(`${decision.reason==='outside'?'Je browserlocatie ligt buiten het gebied van deze streekgids.':'Je browserlocatie kon niet nauwkeurig genoeg worden bepaald.'} We tonen daarom vermeldingen rond ${selectedArea?.name??'Duras'}, met dezelfde afstand en categorie.`);
      },
      () => {if(request!==locationRequest.current)return;setLocating(false);setVisitorLocation(null);setLocationNotice(`Je locatie is niet beschikbaar of niet gedeeld. Je zoekt daarom rond ${selectedArea?.name??'Duras'}.`);},
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  function selectArea(areaId: string) {
    locationRequest.current++;setLocating(false);setLocationNotice('');
    setVisitorLocation(null);
    setSelectedAreaId(areaId);
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
    try { const ok=await loadData(isAdmin);if(!ok){setMessage('');return;}setDataRevision(value=>value+1);setMessage('Opgeslagen gegevens vernieuwd om '+new Date().toLocaleTimeString(intlLocale[locale])+'. Externe imports zijn niet gestart.'); }
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
      await loadData(confirmedAdmin&&!newListingOnly);
      if (confirmedAdmin && active && !newListingOnly) {
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
    if (!supabase || !isAdmin || newListingOnly) return;
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
    await loadData(confirmedAdmin&&!newListingOnly);
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
    if(!supabase||!isAdmin||bulkApprovalInFlight.current||importing||updatingEventId||!bulkApprovalCandidates)return;
    const candidates=bulkApprovalCandidates;
    if(!candidates.length)return;
    bulkApprovalInFlight.current=true;
    setBulkApprovalCandidates(null);setBulkApprovalError('');
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
      const failure=`${approved} imports goedgekeurd. De actie is gestopt: ${cause instanceof Error?cause.message:'Verbindingsfout'}. Je kunt opnieuw starten voor de resterende wachtende imports.`;
      setBulkApprovalError(failure);setError(failure);
    }finally{bulkApprovalInFlight.current=false;setBulkApproving(false);}
  }

  async function setEventStatus(event: EventRow, status: "approved" | "rejected") {
    if (!supabase) {
      setError("Geen Supabase-verbinding.");
      return;
    }

    setError("");
    setMessage("");
    setUpdatingEventId(event.id);

    try {
      const session=await supabase.auth.getSession();
      const response=await fetch('/api/admin/event-review',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.data.session?.access_token},body:JSON.stringify({id:event.id,status})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'De beslissing kon niet worden opgeslagen.');
      setEvents(current => current.map(item => item.id === event.id ? {...item, status, verified: status === "approved",promotion_status:data.promotion_status} : item));
      setMessage(status === "approved" ? `“${event.title}” is goedgekeurd.` : `“${event.title}” is afgewezen.`);
    } catch(cause) {setError(cause instanceof Error?cause.message:'De beslissing kon niet worden opgeslagen.');}
    finally {setUpdatingEventId(null);}
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
    if (!window.confirm(t(`“${event.title}” uit de actieve lijst verwijderen? De vermelding verdwijnt van de website. Bestaande facturen blijven bewaard.`))) return;

    setError("");
    setMessage("");
    setUpdatingEventId(event.id);
    try {
      const { data, error: deleteError } = await supabase.rpc("archive_event", {p_event_id: event.id});
      if (deleteError) throw new Error(deleteError.message);
      if (!data) throw new Error("De vermelding is niet verwijderd. Controleer je beheerderstoegang.");
      setEvents((current) => current.filter((item) => item.id !== event.id));
      if (editingEventId === event.id) { setEditingEventId(null); setEditDraft(null); }
      setMessage(`“${event.title}” is verwijderd.`);
    } catch (cause) {
      setError(`Verwijderen van “${event.title}” is mislukt: ${cause instanceof Error ? cause.message : "Probeer opnieuw."}`);
    } finally { setUpdatingEventId(null); }
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
    setOwnerEmail("");
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
    setPromotionTypes([]);
    setAdvertiser({...emptyAdvertiser});
    setEntryKind("event");
  }

  async function payForSubmittedListing(fragment: string) {
    if (checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setCheckoutStarting(true);
    setCheckoutError("");
    let leavingForMollie = false;
    try {
      // Mollie returns to this same origin. Retain access before leaving so
      // the advertiser can see the payment result without another login.
      try { sessionStorage.setItem('cdd-management-session', fragment); }
      catch { throw Error('Je browser kan de toegang na het betalen niet bewaren. Sta tijdelijke browseropslag toe en probeer opnieuw. Je beheerlink blijft hieronder beschikbaar.'); }
      const checkoutUrl = await requestListingCheckout(fragment);
      window.location.assign(checkoutUrl);
      leavingForMollie = true;
    } catch (cause) {
      setCheckoutError(cause instanceof Error ? cause.message : "Mollie kon niet worden geopend. Probeer opnieuw; je aanvraag blijft bewaard.");
    } finally {
      if (!leavingForMollie) {
        checkoutInFlight.current = false;
        setCheckoutStarting(false);
      }
    }
  }

  async function saveEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || checkoutInFlight.current) return;
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
      try { validateAdvertiser(promotionType,advertiser); advertisingSelectionQuote(promotionTypes,advertiser); } catch(cause) { setSubmissionError(cause instanceof Error?cause.message:"Controleer de factuurgegevens.");return; }
    }

    const website = normalizeWebAddress(websiteUrl);
    const booking = normalizeWebAddress(bookingUrl);
    const source = normalizeWebAddress(sourceUrl);
    if (!website || !booking || !source) {
      setSubmissionError("Vul een geldig webadres in bij Website, Reserveringslink en Informatiebron. Een adres met www. wordt automatisch aangevuld met https://.");
      return;
    }
    if (promotionTypes.includes("category") && !categoryId) {
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

      const response = await fetch("/api/visitor-events", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:payload,categoryId:categoryId||null,placements:promotionTypes,advertiser:promotionType==='none'?null:advertiser,ownerEmail,locale})});
      const result = await readApiJson<{error?:string;manageFragment?:string;advertising?:ListingPaymentSummary|null}>(response);
      if(!response.ok||!result.manageFragment)throw new Error(result.error||"De vermelding kon niet worden opgeslagen.");
      const privateLink=window.location.origin+"/mijn-vermelding#"+result.manageFragment;
      setManagementLink(privateLink);
      try {const links=JSON.parse(localStorage.getItem('cdd-managed-links')||'[]');links.push({title:payload.title,fragment:result.manageFragment});localStorage.setItem('cdd-managed-links',JSON.stringify(links));}catch{}

      eventSaved = true;
      const payment = promotionType === "none" ? null : {
        ...(result.advertising ?? {placement:promotionType,...advertisingSelectionQuote(promotionTypes,advertiser)}),
        title:payload.title,
        manageFragment:result.manageFragment,
      };
      setSubmissionPayment(payment);
      setCheckoutError("");
      resetForm();
      setShowForm(false);

      // Refreshing the agenda must not hold up the advertiser's checkout.
      void loadData().catch((cause) => {
        console.error("[visitor-event] refresh after submission failed", cause);
      });
      const photoConfirmation = uploadedImageUrl ? " De foto is meegestuurd en verschijnt na controle bij het evenement." : "";
      setSubmissionNotice(promotionType === "none"
        ? `Dank je voor je tip over “${payload.title}”. De beheerder controleert de gegevens voordat het evenement in de agenda verschijnt.${photoConfirmation}`
        : `Je vermelding “${payload.title}” en advertentieaanvraag zijn opgeslagen. Je gaat direct door naar Mollie. De advertentie verschijnt na goedkeuring en betaalbevestiging, binnen de gekozen periode.${photoConfirmation}`);
      if (payment) {
        requestAnimationFrame(() => document.getElementById('submission-payment')?.scrollIntoView({behavior:'smooth',block:'center'}));
        void payForSubmittedListing(payment.manageFragment);
      }
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
        setMessage(`${inserted} nieuwe activiteiten toegevoegd; ${skipped} bestaande activiteiten behouden. Nieuwe activiteiten uit de geselecteerde bronnen zijn automatisch goedgekeurd.`);
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
        p_event: { ...eventPayload, submission_kind: "manual" },
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
    return new Date(value).toLocaleString(intlLocale[locale], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatCardDate(value?: string | null) {
    if (!value) return { day: "—", month: "" };
    const date = new Date(value);
    return {
      day: date.toLocaleDateString(intlLocale[locale], { day: "numeric" }),
      month: date.toLocaleDateString(intlLocale[locale], { month: "short" }).replace(".", ""),
    };
  }

  function browseTheme(keywords: RegExp) {
    const matchingCategory = categories.find((category) => keywords.test(`${category.name ?? ""} ${category.slug ?? ""}`));
    setCategoryFilter(matchingCategory?.id ?? "all");
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
    physiotherapist: 25,
    psychologist: 25,
    supermarket: 25,
    fuel: 25,
    charging: 25,
    public_transport: 25,
    parking: 25,
    disabled_parking: 25,
    bakery: 25,
    butcher: 25,
    tobacco: 25,
    souvenirs: 25,
    shoes: 25,
    florist: 25,
    fashion: 25,
    diy: 25,
    jeweller: 25,
    hairdresser: 25,
    estate_agent: 25,
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
  const municipalityServiceGroupTypes = municipalityServiceOptions.filter((option) => option.id !== "all");
  const municipalityMapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${municipalityServiceLabel} ${municipalityName}`)}`;
  const municipalityLibrarySearchUrl = `https://ccfr.bnf.fr/portailccfr/jsp/query_direct.jsp?query=rnbcd_menu_inst_pub&VILLE=${encodeURIComponent(municipalityName)}`;
  const municipalityDoctolibSlug = municipalityName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const municipalityDoctolibSearchUrl = `https://www.doctolib.fr/medecin-generaliste/${municipalityDoctolibSlug}`;
  const municipalityPhysiotherapistSearchUrl = `https://www.doctolib.fr/masseur-kinesitherapeute/${municipalityDoctolibSlug}`;
  const municipalityPsychologistSearchUrl = `https://www.doctolib.fr/psychologue/${municipalityDoctolibSlug}`;
  const renderMunicipalityServiceCard = (service: MunicipalityServiceEntry, index: number, groupType: MunicipalityServiceType) => {
    const groupLabel = municipalityServiceOptions.find((option) => option.id === groupType)?.label ?? municipalityServiceLabel;
    return <article className={`municipality-service-card${service.highlighted?' municipality-service-highlighted':''}`} key={`${groupType}-${service.id}`}>
      <T>{service.highlighted&&<div className="activity-highlight-banner"><T>{"Advertentie · Uitgelichte vermelding"}</T></div>}</T>
      <MunicipalServicePhoto {...service}/>
      <div className="municipality-service-card-heading">
        <div><p className="section-kicker"><T>{groupLabel}</T><T>{service.inSelectedMunicipality === false ? ` · omgeving ${municipalityName}` : service.municipality ? ` · ${service.municipality}` : ""}</T><T>{service.distanceKm != null ? ` · ${service.distanceKm} km` : ""}</T></p><h3><T preserve>{localizeMunicipalName(service.name,locale)}</T></h3></div>
        <T>{service.type === "hospital" && index === 0 && <span className="nearest-service-badge"><T>{"Dichtstbij"}</T></span>}</T>
      </div>
      <T>{(groupType === "mairie" || municipalityServiceType === "all" && service.type === "mairie") && <p><strong><T>{"Burgemeester:"}</T></strong> <T>{service.mayor ?? "Naam niet vermeld in de gemeentelijke contactgegevens."}</T></p>}</T>
      <T>{service.address && <p><strong><T>{"Adres:"}</T></strong> <T preserve>{service.address}</T></p>}</T>
      <T>{SHOP_TYPES.includes(service.type)&&!service.address&&<p className="municipality-missing-detail"><T>{"Geen straatadres gepubliceerd in de geraadpleegde bron."}</T></p>}</T>
      <T>{service.phone && <p><strong><T>{"Telefoon:"}</T></strong> <a href={`tel:${service.phone.replace(/[^\d+]/g, "")}`}><T preserve>{service.phone}</T></a></p>}</T>
      <T>{service.email && <p><strong><T>{"E-mail:"}</T></strong> <a href={`mailto:${service.email}`}><T preserve>{service.email}</T></a></p>}</T>
      <T>{service.openingHours && <p><strong><T>{"Openingstijden:"}</T></strong> <T>{service.openingHours}</T></p>}</T>
      <T>{service.serviceTimes && <p><strong><T>{"Mis- of diensttijden:"}</T></strong> <T>{service.serviceTimes}</T></p>}</T>
      <T>{(groupType === "church" || municipalityServiceType === "all" && service.type === "church") && !service.serviceTimes && <p className="municipality-missing-detail"><T>{"Mis- of diensttijden zijn niet vermeld bij deze bron. Neem contact op met de kerk of parochie."}</T></p>}</T>
      <T>{service.extra && <p>{service.extra.split(/(?<=\.)\s+(?=[A-ZÀ-ÖØ-Þ])/u).map((sentence,index)=><span key={index}><T>{sentence}</T>{" "}</span>)}</p>}</T>
      <T>{COMMERCIAL_SERVICE_TYPES.includes(service.type)&&!service.hasActiveAdvertising&&<p><a className="more-customers-button" href={'/adverteren?'+new URLSearchParams({serviceId:service.id,city:service.municipality||municipalityName})}><T>Meer klanten bereiken</T><span aria-hidden="true"> →</span></a></p>}</T>
      <T>{COMMERCIAL_SERVICE_TYPES.includes(service.type)&&<p><a className="text-arrow-link" href={'/mijn-vermelding?'+new URLSearchParams({serviceId:service.id,city:service.municipality||municipalityName,title:service.name})}><T>{"Mijn vermelding: beheren of een correctie doorgeven →"}</T></a></p>}</T>
      <div className="municipality-service-links">
        <T>{safeHttpUrl(service.website) && <a href={safeHttpUrl(service.website)!} target="_blank" rel="noreferrer"><T>{"Website "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
        <T>{safeHttpUrl(service.sourceUrl) && <a href={safeHttpUrl(service.sourceUrl)!} target="_blank" rel="noreferrer"><T>{"Bron: "}</T><T>{service.sourceName ?? "gegevens bekijken"}</T> <span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
        <T>{safeHttpUrl(service.secondarySourceUrl) && <a href={safeHttpUrl(service.secondarySourceUrl)!} target="_blank" rel="noreferrer"><T>{"Extra bron: "}</T><T>{service.secondarySourceName ?? "controleren"}</T> <span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
        <T>{(groupType === "mairie" || municipalityServiceType === "all" && service.type === "mairie") && safeHttpUrl(service.mayorSourceUrl) && <a href={safeHttpUrl(service.mayorSourceUrl)!} target="_blank" rel="noreferrer"><T>{"Bron burgemeester: "}</T><T>{service.mayorSourceName ?? "Ministerie van Binnenlandse Zaken"}</T> <span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
        <T>{safeHttpUrl(service.appointmentUrl) && <a href={safeHttpUrl(service.appointmentUrl)!} target="_blank" rel="noreferrer"><T>{"Afspraak via Maiia "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
        <T>{(groupType === "doctor" || municipalityServiceType === "all" && service.type === "doctor") && <a href={safeHttpUrl(service.doctolibUrl) ?? municipalityDoctolibSearchUrl} target="_blank" rel="noreferrer"><T>{"Doctolib "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
        <T>{(groupType === "physiotherapist" || municipalityServiceType === "all" && service.type === "physiotherapist") && <a href={municipalityPhysiotherapistSearchUrl} target="_blank" rel="noreferrer"><T>{"Zoek kinésithérapeutes op Doctolib "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
        <T>{(groupType === "psychologist" || municipalityServiceType === "all" && service.type === "psychologist") && <a href={municipalityPsychologistSearchUrl} target="_blank" rel="noreferrer"><T>{"Zoek psychologues op Doctolib "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(service.latitude != null && service.longitude != null ? `${service.latitude},${service.longitude}` : `${service.name} ${service.address ?? municipalityName}`)}`} target="_blank" rel="noreferrer"><T>{"Kaart: Google Maps "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>
      </div>
    </article>;
  };
  function openEventEntryForm(event?:{preventDefault:()=>void}) {
    event?.preventDefault();
    window.location.assign('/evenement/nieuw');
  }
  const listingContent=<>
      <T>{showForm && (
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
          <section className={entry.identity} aria-labelledby="entry-identity-heading"><h2 id="entry-identity-heading"><T>{"Jouw vermelding"}</T></h2><p><T>{"Begin met de naam en categorie. Deze gegevens zie je terug in je voorbeelden."}</T></p>
          <label style={labelStyle}><T>{"Wat wil je invoeren?"}</T><select style={inputStyle} value={entryKind} onChange={e=>setEntryKind(e.target.value)}><option value="event"><T>{"Evenement met datum"}</T></option><option value="directory"><T>{"Vaste vermelding / bedrijf / accommodatie"}</T></option></select></label>
          <label style={labelStyle}><T>Je e-mailadres voor de beheerlink</T> *<input style={inputStyle} type="email" required maxLength={254} autoComplete="email" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)}/><small><T>Na goedkeuring ontvang je hier automatisch je persoonlijke beheerlink. Dit e-mailadres wordt niet openbaar getoond.</T></small></label>
          <div>
            <label htmlFor="event-entry-field-1" style={labelStyle}><T>{"Titel *"}</T></label>
            <A><input id="event-entry-field-1"
              style={inputStyle}
              maxLength={180}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijvoorbeeld: Marché nocturne"
            /></A>
          </div>

          <div>
            <label htmlFor="event-entry-field-2" style={labelStyle}><T>{"Categorie"}</T><T>{promotionTypes.includes("category") ? " * (verplicht voor categoriepromotie)" : ""}</T></label>
            <select id="event-entry-field-2"
              style={inputStyle}
              required={promotionTypes.includes("category")}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value=""><T>{"Kies een categorie"}</T></option>
              <T>{categories.map((category) => (
                <option key={category.id} value={category.id}>
                  <T>{category.name ?? category.slug ?? category.id}</T>
                </option>
              ))}</T>
            </select>
          </div>

          </section>
          <div className="visitor-photo-field visitor-photo-field-prominent">
            <label htmlFor="visitor-event-photo" style={labelStyle}><T>{"Foto van het evenement uploaden (optioneel)"}</T></label>
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
            <p className="visitor-photo-help"><T>{"Klik op ‘Bestand kiezen’ om een foto vanaf je telefoon of computer toe te voegen. JPG, PNG of WebP, maximaal 5 MB. De foto verschijnt na controle door de beheerder."}</T></p>
            <T>{visitorPhotoPreview && <div className="visitor-photo-preview"><A><img src={visitorPhotoPreview} alt="Voorbeeld van de gekozen evenementfoto" /></A><button type="button" onClick={() => { setVisitorPhoto(null); if (visitorPhotoInputRef.current) visitorPhotoInputRef.current.value = ""; }}><T>{"Foto verwijderen"}</T></button></div>}</T>
          </div>

          <fieldset className="promotion-fieldset">
            <legend className={entry.srOnly}><T>{"Extra bereik voor je evenement (optioneel)"}</T></legend>
            <EventAdvertisingExamples value={promotionTypes} onChange={setPromotionTypes} months={advertiser.months} onMonthsChange={months=>setAdvertiser(previous=>({...previous,months}))} title={title} city={cityChoice==='__other__'?customCity:cityChoice} category={categories.find(category=>category.id===categoryId)?.name||''} image={visitorPhotoPreview} categories={categories.map(item=>({id:item.id,name:item.name||item.slug||item.id}))} description={shortDescription} date={entryKind==='directory'?'':startAt}/>

          </fieldset>

          <div id="event-details" className={entry.detailsHeading}><p><T>{"03 · Gegevens van je vermelding"}</T></p><h2><T>{"De informatie voor je bezoekers"}</T></h2><span><T>{"Vul je beschrijving, datum, locatie en contactlinks in. De beheerder controleert je inzending voor publicatie."}</T></span></div>
          <div>
            <label htmlFor="event-entry-field-3" style={labelStyle}><T>{"Korte beschrijving"}</T></label>
            <input id="event-entry-field-3"
              style={inputStyle}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              maxLength={250}
            />
          </div>

          <div>
            <label htmlFor="event-entry-field-4" style={labelStyle}><T>{"Uitgebreide beschrijving"}</T></label>
            <textarea id="event-entry-field-4"
              style={{ ...inputStyle, minHeight: 110 }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <T>{entryKind === "event" && <>
          <div>
            <label htmlFor="event-entry-field-5" style={labelStyle}><T>{"Begindatum en -tijd *"}</T></label>
            <input id="event-entry-field-5"
              style={inputStyle}
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="event-entry-field-6" style={labelStyle}><T>{"Einddatum en -tijd"}</T></label>
            <input id="event-entry-field-6"
              style={inputStyle}
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>

          </>}</T>
          <div>
            <label htmlFor="event-entry-field-7" style={labelStyle}><T>{"Locatie / zaal"}</T></label>
            <input id="event-entry-field-7"
              style={inputStyle}
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="event-entry-field-8" style={labelStyle}><T>{"Adres"}</T></label>
            <input id="event-entry-field-8"
              style={inputStyle}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="event-entry-field-9" style={labelStyle}><T>{"Postcode"}</T></label>
            <input id="event-entry-field-9"
              style={inputStyle}
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="visitor-event-city" style={labelStyle}><T>{"Plaats *"}</T></label>
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
              <option value="" disabled><T>{"Kies een plaats"}</T></option>
              <T>{alphabeticalPlaces(areaOptions).map(area => <option key={area.id} value={area.name}><T>{area.name}</T></option>)}</T>
              <option value="__other__"><T>{"Andere plaats…"}</T></option>
            </select>
            <T>{cityChoice === "__other__" && (
              <A><input
                style={{ ...inputStyle, marginTop: 8 }}
                aria-label="Andere plaatsnaam"
                required
                maxLength={120}
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="Vul de plaatsnaam in"
              /></A>
            )}</T>
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
            /><T>{"Dit evenement is gratis "}</T></label>

          <T>{!isFree && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 12,
              }}
            >
              <div>
               <label htmlFor="event-entry-field-10" style={labelStyle}><T>{"Prijs vanaf (€)"}</T></label>
                <input id="event-entry-field-10"
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceFrom}
                  onChange={(e) => setPriceFrom(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="event-entry-field-11" style={labelStyle}><T>{"Prijs tot (€)"}</T></label>
                <input id="event-entry-field-11"
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceTo}
                  onChange={(e) => setPriceTo(e.target.value)}
                />
              </div>
            </div>
          )}</T>

          <div>
            <label htmlFor="event-websiteUrl" style={labelStyle}><T>{"Website * — https://"}</T></label>
            <A><input id="event-websiteUrl" style={inputStyle} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" required value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} onBlur={() => { const address = normalizeWebAddress(websiteUrl); if (address) setWebsiteUrl(address); }} placeholder="https://www.voorbeeld.fr" /></A>
          </div>

          <div>
            <label htmlFor="event-bookingUrl" style={labelStyle}><T>{"Reserveringslink * — https://"}</T></label>
            <A><input id="event-bookingUrl" style={inputStyle} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" required value={bookingUrl} onChange={e => setBookingUrl(e.target.value)} onBlur={() => { const address = normalizeWebAddress(bookingUrl); if (address) setBookingUrl(address); }} placeholder="https://www.voorbeeld.fr" /></A>
          </div>

          <div>
            <label htmlFor="event-sourceUrl" style={labelStyle}><T>{"Informatiebron * — https://"}</T></label>
            <A><input id="event-sourceUrl" style={inputStyle} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" required value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} onBlur={() => { const address = normalizeWebAddress(sourceUrl); if (address) setSourceUrl(address); }} placeholder="https://www.voorbeeld.fr" /></A>
          </div>

          <p><T>{"Je kunt ook www.voorbeeld.fr invoeren; https:// wordt automatisch toegevoegd. Gebruik dezelfde website als er geen aparte reserveringspagina of bronpagina is."}</T></p>
            <T>{promotionType !== "none" && <A><section id="advertiser-details" aria-label="Gekozen advertentie"><p role="status"><strong><T>{"Gekozen: "}</T><T>{promotionNames}</T><T>{"."}</T></strong><T>{" Vul je periode, factuurgegevens en vermelding in. Daarna ga je direct door naar Mollie."}</T></p><AdvertiserFields type={promotionType} placements={promotionTypes} value={advertiser} onChange={setAdvertiser}/></section></A>}</T>
          <T>{promotionType !== 'none' && <div className="advertising-checkout-summary"><strong><T>{promotionNames}</T><T>{" · "}</T><T>{formatAdvertisingAmount(promotionAmount)}</T><T>{" totaal"}</T></strong><p><T>{"Voor "}</T><T>{advertiser.months}</T> <T>{advertiser.months === 1 ? 'maand' : 'maanden'}</T><T>{advertiser.startDate ? ` vanaf ${advertiser.startDate}` : ''}</T><T>{". Je slaat je vermelding op en gaat direct naar Mollie om je betaalmethode te kiezen. Je hoeft niet opnieuw in te loggen."}</T></p></div>}</T>
          <button
            type="submit"
            disabled={saving || checkoutStarting}
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
            <T>{saving ? (promotionType === 'none' ? 'Opslaan…' : 'Opslaan en betaling voorbereiden…') : promotionType === 'none' ? 'Evenement/vermelding opslaan' : `Opslaan en betalen via Mollie · ${formatAdvertisingAmount(promotionAmount)}`}</T>
          </button>
        </form>
      )}</T>

      <T>{submissionError && <p role="alert" style={{ padding: 12, background: "#fff1f2", color: "#9f1239", borderRadius: 8 }}><T>{submissionError}</T></p>}</T>
      <T>{submissionPayment && <section id="submission-payment" className="submission-payment" aria-labelledby="submission-payment-heading" aria-busy={checkoutStarting}>
        <p className="section-kicker"><T>{"Je aanvraag is opgeslagen"}</T></p>
        <h2 id="submission-payment-heading"><T>{checkoutStarting ? 'Je gaat naar Mollie' : 'Betaal je advertentie via Mollie'}</T></h2>
        <p><strong><T>{submissionPayment.title}</T></strong></p>
        <dl><div><dt><T>{"Advertentie"}</T></dt><dd><T>{(submissionPayment.placements??[submissionPayment.placement]).map(advertisingPlacementName).join(" + ")}</T></dd></div><div><dt><T>{"Periode"}</T></dt><dd><T>{submissionPayment.startDate}</T><T>{" tot "}</T><T>{submissionPayment.endDate}</T><T>{" · "}</T><T>{submissionPayment.months}</T> <T>{submissionPayment.months === 1 ? 'maand' : 'maanden'}</T></dd></div><div className="submission-payment-total"><dt><T>{"Totaal te betalen"}</T></dt><dd><T>{formatAdvertisingAmount(submissionPayment.amountCents)}</T></dd></div></dl>
        <p><T>{"Je kiest je betaalmethode in de beveiligde omgeving van Mollie. Opnieuw inloggen is niet nodig."}</T></p>
        <T>{checkoutStarting && <p role="status"><T>{"De betaalomgeving wordt geopend…"}</T></p>}</T>
        <T>{checkoutError && <p className="submission-payment-error" role="alert"><T>{"Je vermelding en advertentieaanvraag blijven bewaard. "}</T><T>{checkoutError}</T></p>}</T>
        <button className="button button-dark" type="button" disabled={checkoutStarting} onClick={() => void payForSubmittedListing(submissionPayment.manageFragment)}><T>{checkoutStarting ? 'Mollie wordt geopend…' : `Verder naar Mollie · ${formatAdvertisingAmount(submissionPayment.amountCents)}`}</T> <span aria-hidden="true"><T>{"→"}</T></span></button>
        <p className="submission-payment-note"><T>{"De advertentie verschijnt na goedkeuring en betaalbevestiging, uitsluitend binnen de gekozen periode. De beheerlink hieronder is voor latere wijzigingen."}</T></p>
      </section>}</T>
      <T>{managementLink && <aside className="management-link-notice" aria-labelledby="management-confirmation-title"><h3 id="management-confirmation-title"><T>{"Je vermelding is ingestuurd — bewaar je beheerlink"}</T></h3><p><T>{"Met deze persoonlijke link kun je zelf de tekst, datum, contactgegevens en foto wijzigen, zonder account. Bewaar de link als een wachtwoord en deel hem niet met anderen."}</T></p><a className="button button-dark" href={managementLink}><T>{"Mijn vermelding beheren →"}</T></a><label><T>{"Persoonlijke link"}</T><input readOnly value={managementLink} onFocus={e=>e.target.select()}/></label><div className="management-link-actions"><button type="button" onClick={()=>void navigator.clipboard.writeText(managementLink).catch(()=>setSubmissionError("Selecteer en kopieer de persoonlijke link hierboven."))}><T>{"Beheerlink kopiëren"}</T></button><a download="Cote-de-Duras-beheerlink.txt" href={'data:text/plain;charset=utf-8,'+encodeURIComponent('Persoonlijke beheerlink Côte de Duras\n\n'+managementLink+'\n\nBewaar deze link als een wachtwoord. Iedereen met deze link kan je vermelding wijzigen.\n')}><T>{"Beheerlink bewaren als bestand"}</T></a></div><p><T>{"Na goedkeuring ontvang je ook een e-mail met je persoonlijke beheerlink."}</T></p></aside>}</T>
      <T>{submissionNotice && <p role="status" style={{ padding: 12, background: "#ecfdf5", color: "#065f46", borderRadius: 8 }}><T>{submissionNotice}</T></p>}</T>

</>;
  if(newListingOnly)return <NewEventExperience title={title||submissionPayment?.title||''} city={cityChoice==='__other__'?customCity:cityChoice} category={categories.find(item=>item.id===categoryId)?.name||''}><T>{listingContent}</T></NewEventExperience>;

  return (
    <main className="visitor-site">
      <header className="site-header">
        <div className="site-nav">
          <A><a className="brand-lockup" href="#top" aria-label="Côte de Duras, naar de startpagina">
            <span className="brand-mark" aria-hidden="true"><A><img src="/cote-de-duras-logo.webp" alt="" width={240} height={180} decoding="async" /></A></span>
            <span className="brand-name"><strong><T>{"CÔTE DE DURAS"}</T></strong></span>
          </a></A>
          <a className="my-listing-link" href="/mijn-vermelding"><T>Vermelding toevoegen / beheren</T><span aria-hidden="true"><T>{"→"}</T></span></a>
          <A><nav className="primary-nav" aria-label="Hoofdnavigatie">
            <a href="/de-streek-beleven"><T>{"De streek beleven"}</T></a>
            <a href="#agenda"><T>{"Agenda"}</T></a>
            <a href="#ontdekken"><T>{"Ontdekken"}</T></a>
            <a href="#gemeenten"><T>{"Gemeente informatie"}</T></a>
            <a href="/handleiding"><T>{"Handleiding"}</T></a>
          </nav></A>
        </div>
        <div className="hero-grid" id="top">
          <div className="hero-art" aria-hidden="true"><A><img src="/lot-et-garonne-hero.png" alt="" /></A></div>
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-copy">
            <p className="hero-kicker"><span aria-hidden="true" /><T>{" Leven, beleven en ontdekken in het zuidwesten"}</T></p>
            <h1><T>{"Côte de Duras"}</T></h1>
            <p className="hero-intro"><T>{"Evenementen en informatie voor elke dag binnen een straal van 50 kilometer"}</T></p>
          </div>
        </div>
      </header>

      <section id="agenda" className="search-panel agenda-search-panel" aria-labelledby="nearby-heading">
        <div className="search-heading">
          <div>
            <p className="section-kicker"><T>{"Agenda voor Duras en omgeving"}</T></p>
            <h2 id="nearby-heading"><T>{"Vind jouw volgende uitje"}</T></h2>
            <p><T>{"Zoek eenvoudig op datum, afstand, plaats en categorie."}</T></p>
          </div>
          <div className="search-count" aria-live="polite"><strong><T>{nearbyLoading ? "…" : visibleNearbyEvents.length}</T></strong><span><T>{"activiteiten"}</T><br /><T>{"in de buurt"}</T></span></div>
        </div>
        <div className="search-controls search-controls-primary">
          <label className="field-label" style={labelStyle}><T>{"Zoek binnen "}</T><select style={inputStyle} value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
              <T>{SEARCH_RADIUS_OPTIONS.map((radius) => <option key={radius} value={radius}><T>{radius}</T><T>{" kilometer"}</T></option>)}</T>
            </select>
          </label>
          <button className="location-button" type="button" disabled={locating} onClick={useCurrentLocation}>
            <span aria-hidden="true"><T>{"⌖"}</T></span> <T>{locating?'Locatie bepalen…':'Gebruik mijn locatie'}</T>
          </button>
        </div>
        <div className="search-controls search-date-controls">
          <label className="field-label" style={labelStyle}><T>{"Begindatum"}</T>
            <input type="date" style={inputStyle} value={eventDateFrom} onChange={event => setEventDateFrom(event.target.value)} aria-describedby="event-date-help" aria-invalid={!!dateFilter.error} />
          </label>
          <label className="field-label" style={labelStyle}><T>{"Einddatum"}</T>
            <input type="date" style={inputStyle} value={eventDateTo} min={eventDateFrom || undefined} onChange={event => setEventDateTo(event.target.value)} aria-describedby="event-date-help" aria-invalid={!!dateFilter.error} />
          </label>
          <button className="location-reset-button date-reset-button" type="button" disabled={!eventDateFrom && !eventDateTo} onClick={() => {setEventDateFrom('');setEventDateTo('');}}><T>{"Datums wissen"}</T></button>
        </div>
        <p id="event-date-help" className="date-filter-help"><T>{"Eén datum zoekt op die dag. Twee datums zoeken binnen die periode, inclusief begin- en einddag. Zonder datums zie je ook vaste vermeldingen."}</T></p>
        {dateFilter.error && <p className="date-filter-error" role="alert"><T>{dateFilter.error}</T></p>}
        <div className="search-controls search-controls-secondary">
          <label className="field-label" style={labelStyle}><T>{"Plaats "}</T><select style={inputStyle} value={selectedAreaId} onChange={(event) => selectArea(event.target.value)}>
              <T>{renderAreaOptions()}</T>
            </select>
          </label>
          <label className="field-label" style={labelStyle}><T>{"Soort activiteit "}</T><select style={inputStyle} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all"><T>{"Alle soorten"}</T></option>
              <T>{[...categories].sort((a,b)=>t(a.name??a.slug??"").localeCompare(t(b.name??b.slug??""),locale,{sensitivity:"base"})).map((category) => <option key={category.id} value={category.id}><T>{category.name ?? category.slug ?? "Activiteit"}</T></option>)}</T>
            </select>
          </label>
          <label className="free-filter" style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 9, paddingBottom: 12 }}>
            <input type="checkbox" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} /><T>{"Alleen gratis activiteiten "}</T></label>
        </div>
        <div className="results-summary" role="status" aria-live="polite">
          <span className="results-indicator" aria-hidden="true" />
          <strong><T>{nearbyLoading ? "We zoeken iets leuks voor je…" : visibleNearbyEvents.length===1?`${visibleNearbyEvents.length} activiteit gevonden`:`${visibleNearbyEvents.length} activiteiten gevonden`}</T></strong>
          <T>{!nearbyLoading && <span><T>{"binnen "}</T><T>{radiusKm}</T><T>{" km van "}</T><T preserve={!deferredVisitorLocation}>{searchLabel}</T><T>{categoryFilter !== "all" || dateFilter.range || freeOnly ? " met je huidige filters" : ""}</T></span>}</T>
          {dateFilter.range && <span className="results-date-range"><T>{"Periode: "}</T>{new Date(dateFilter.range.start+'T12:00:00').toLocaleDateString(intlLocale[locale])}{dateFilter.range.end!==dateFilter.range.start && <> – {new Date(dateFilter.range.end+'T12:00:00').toLocaleDateString(intlLocale[locale])}</>}</span>}
        </div>
        <T>{visitorLocation && <p className="location-note"><T>{"Je zoekt rond je huidige locatie. Deze locatie wordt alleen voor deze zoekopdracht gebruikt. "}</T><button className="location-reset-button" type="button" onClick={() => setVisitorLocation(null)}><T>{"Zoek weer rond "}</T><T>{selectedArea?.name ?? "de gekozen plaats"}</T></button></p>}</T>
        <T>{locationNotice&&<p className="location-fallback-note" role="status"><T>{locationNotice}</T></p>}</T>
      </section>

      <FloatingPromotions key={categoryFilter} events={categoryFilter==='all'?homepagePromotionEvents:categoryPromotionEvents} title={categoryFilter==='all'?'Uitgelicht op de homepage':'Uitgelicht in '+(categories.find(category=>category.id===categoryFilter)?.name??'deze categorie')} headingId={categoryFilter==='all'?'homepage-promotion-heading':'category-promotion-heading'} suppressed={!!selectedVisitorEvent||showForm||municipalityInView} previewSample={previewAdSamplesEnabled?{placement:categoryFilter==='all'?'homepage':'category',categoryName:categoryFilter==='all'?undefined:categories.find(category=>category.id===categoryFilter)?.name}:undefined} onOpen={event=>openVisitorEvent(event,categoryFilter==='all'?'homepage':'category')}/>

      <A><section id="agenda-resultaten" className="agenda-results-panel" aria-label="Agendaresultaten">
        <T>{nearbyError && <p role="alert" style={{ padding: 12, background: "#fff1f2", color: "#9f1239", borderRadius: 8 }}><T>{nearbyError}</T></p>}</T>
        <T>{!nearbyLoading && !nearbyError && !dateFilter.error && visibleNearbyEvents.length === 0 && <p className="empty-results"><T>{"Geen activiteiten gevonden voor deze combinatie van datum, plaats, afstand en categorie. Pas je filters aan of wis de datums om ook vaste vermeldingen te zien."}</T></p>}</T>
        <T>{!nearbyLoading&&!nearbyError&&!dateFilter.error&&standardNearbyEvents.length===0&&<div className="empty-search-actions"><p><T>{"Bekijk een groter gebied of verwijder je zoekfilters."}</T></p><button type="button" onClick={()=>setRadiusKm(50)}><T>{"Zoek binnen 50 kilometer"}</T></button><button type="button" onClick={()=>{setCategoryFilter('all');setFreeOnly(false);}}><T>{"Toon alle soorten activiteiten"}</T></button><button type="button" onClick={()=>{selectArea('duras');setRadiusKm(DEFAULT_SEARCH_RADIUS_KM);setEventDateFrom('');setEventDateTo('');setCategoryFilter('all');setFreeOnly(false);}}><T>{"Bekijk de streek rond Duras"}</T></button></div>}</T>
        <T>{locationlessCount > 0 && <p className="location-note"><T>{locationlessCount}</T><T>{" aankomende "}</T><T>{locationlessCount === 1 ? "activiteit heeft" : "activiteiten hebben"}</T><T>{" nog geen herkenbare plaats en kan daarom niet op afstand worden getoond."}</T></p>}</T>

        <A><div className="event-grid" aria-label="Aankomende activiteiten">
          {previewAdSamplesEnabled&&<CoteDeDurasAdvertisement variant="highlight" placement="highlight" categoryName={categoryFilter==='all'?undefined:categories.find(category=>category.id===categoryFilter)?.name}/>}
          <T>{displayedNearbyEvents.map((event) => (
            <article data-analytics-card="true" data-analytics-event={event.id} data-analytics-placement={hasAdvertisingPlacement(event,"highlight") ? "highlight" : "standard"} className={`activity-card${hasAdvertisingPlacement(event,"highlight") ? " activity-card-highlighted" : ""}`} key={event.id}>
              <T>{hasAdvertisingPlacement(event,"highlight") && <div className="activity-highlight-banner"><T>{"Uitgelichte advertentie"}</T></div>}</T>
              <div className="activity-media">
                <A><button className="activity-image-trigger" type="button" onClick={() => openVisitorEvent(event, hasAdvertisingPlacement(event,"highlight") ? "highlight" : "standard")} aria-label={`Bekijk ${event.title}`}>
                  <EventImage className="activity-image" src={event.image_url} />
                </button></A>
                <span className="distance-pill"><T>{event.distance_is_approximate ? "ca. " : ""}</T><T>{event.distance_km}</T><T>{" km"}</T></span>
              </div>
              <div className="activity-card-content">
                <div className="activity-tags">
                  <T>{categoryIdsForSelection(event.category_ids, categoryFilter).length ? <span className="category-pill"><T>{categoryIdsForSelection(event.category_ids, categoryFilter).map(id => categories.find(category => category.id === id)?.name).filter(Boolean).join(" · ")}</T></span> : null}</T>
                  <T>{event.is_free && <span className="free-pill"><T>{"Gratis"}</T></span>}</T>
                  <T>{hasAdvertisingPlacement(event,"highlight") && <span className="sponsored-label"><T>{"Uitgelicht"}</T></span>}</T>
                  <T>{categoryFilter !== "all" && event.category_ids?.includes(categoryFilter) && hasAdvertisingPlacement(event,"category") && <span className="sponsored-label"><T>{"Categoriepartner"}</T></span>}</T>
                </div>
                <h3><button className="activity-title-button" type="button" onClick={() => openVisitorEvent(event, hasAdvertisingPlacement(event,"highlight") ? "highlight" : "standard")}><T preserve={event.is_directory_entry===true&&!event.title.startsWith("VOORBEELD")}>{event.title}</T></button></h3>
                <p className="activity-date"><T>{formatDate(event.start_at)}</T><T>{event.end_at ? ` – ${formatDate(event.end_at)}` : ""}</T></p>
                <p className="activity-place"><span aria-hidden="true"><T>{"⌖"}</T></span> <T>{[event.venue_name, event.address, event.postcode, event.city].filter(Boolean).join(", ") || event.city}</T></p>
                <T>{(event.short_description || event.description) && <p className="activity-description"><T>{event.short_description || event.description}</T></p>}</T>
                <div className="activity-links">
                  {!hasActiveAdvertising(event)&&<a className="more-customers-button" href={'/adverteren?eventId='+event.id}><T>Meer klanten bereiken</T><span aria-hidden="true"> →</span></a>}
                  <button className="activity-link activity-link-detail" type="button" onClick={() => openVisitorEvent(event, hasAdvertisingPlacement(event,"highlight") ? "highlight" : "standard")}><T>{"Bekijk evenementdetails "}</T><span aria-hidden="true"><T>{"→"}</T></span></button>
                  <T>{publicEventUrl(event.booking_url) && <a className="activity-link activity-link-primary" data-analytics-channel="booking" href={publicEventUrl(event.booking_url)!} target="_blank" rel="noreferrer"><T>{"Reserveren "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
                  <T>{publicEventUrl(event.website_url) && <a className="activity-link" data-analytics-channel="website" href={publicEventUrl(event.website_url)!} target="_blank" rel="noreferrer"><T>{"Website "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
                </div>
                <p className="external-link-note"><T>{"Externe pagina’s openen in een nieuw tabblad; deze agenda blijft open."}</T></p>
              </div>
            </article>
          ))}</T>
        </div></A>
        <T>{displayedNearbyEvents.length < standardNearbyEvents.length && <button className="show-more-events" type="button" onClick={() => setVisibleEventCount((count) => Math.min(count + 18, standardNearbyEvents.length))}><T>{"Toon meer activiteiten ("}</T><T>{standardNearbyEvents.length - displayedNearbyEvents.length}</T><T>{" resterend)"}</T></button>}</T>
        <div className="tip-invitation" id="tip-activiteit">
          <div><p className="section-kicker"><T>{"Ken jij de streek?"}</T></p><strong><T>{"Staat jouw favoriete activiteit er nog niet bij?"}</T></strong><p><T>{"Geef de tip door. De beheerder controleert de informatie voordat bezoekers het evenement zien."}</T></p><p><T>{"Al een vermelding ingestuurd? "}</T><a href="/mijn-vermelding"><T>{"Beheer je vermelding →"}</T></a></p></div>
          <button className="button button-dark" type="button" onClick={openEventEntryForm} aria-controls="activity-tip-form"><T>{"Een nieuw evenement/vermelding"}</T><span aria-hidden="true"><T>{"→"}</T></span>
          </button>
        </div>
      </section></A>

      <A><section className="discovery-section" id="ontdekken" aria-label="Ontdek de streek">
        <a className="discovery-tile discovery-agenda" href="#agenda"><span className="discovery-icon" aria-hidden="true"><T>{"▦"}</T></span><span><strong><T>{"Agenda"}</T></strong><small><T>{"Wat is er te doen?"}</T></small></span><span className="discovery-arrow" aria-hidden="true"><T>{"→"}</T></span></a>
        <a className="discovery-tile discovery-towns" href="#gemeenten"><span className="discovery-icon" aria-hidden="true"><T>{"⌖"}</T></span><span><strong><T>{"Gemeentegids"}</T></strong><small><T>{"Lokale diensten & adressen"}</T></small></span><span className="discovery-arrow" aria-hidden="true"><T>{"→"}</T></span></a>
      </section></A>


      <section className="featured-section" aria-labelledby="featured-heading">
        <div className="content-heading"><div><p className="section-kicker"><T>{"Ideeën voor binnenkort"}</T></p><h2 id="featured-heading"><T>{"Binnenkort in de buurt"}</T></h2></div><a className="text-arrow-link" href="#agenda-resultaten"><T>{"Naar de agenda "}</T><span aria-hidden="true"><T>{"→"}</T></span></a></div>
        <T>{featuredEvents.length > 0 ? <div className="featured-events-grid">
          <T>{featuredEvents.map((event) => {
            const date = formatCardDate(event.start_at);
            return <article data-analytics-card="true" data-analytics-event={event.id} data-analytics-placement={"standard"} className={`featured-event-card${hasAdvertisingPlacement(event,"homepage") ? " featured-event-card-sponsored" : ""}`} key={`featured-${event.id}`}>
              <A><button className="featured-event-image" type="button" onClick={() => openVisitorEvent(event)} aria-label={`Bekijk ${event.title}`}>
                <EventImage src={event.image_url} />
              </button></A>
              <div className="featured-event-body"><span className="date-tile"><strong><T>{date.day}</T></strong><small><T>{date.month}</T></small></span><div><T>{hasAdvertisingPlacement(event,"homepage") && <span className="sponsored-label"><T>{"Uitgelicht"}</T></span>}</T><h3><button className="featured-event-title" type="button" onClick={() => openVisitorEvent(event)}><T preserve={event.is_directory_entry===true}>{event.title}</T></button></h3><p><span aria-hidden="true"><T>{"⌖"}</T></span> <T>{event.city || event.venue_name || "Lot-et-Garonne"}</T></p></div></div>
            </article>;
          })}</T>
        </div> : <div className="featured-empty"><span className="featured-empty-icon" aria-hidden="true"><T>{"✦"}</T></span><div><strong><T>{nearbyLoading ? "We zoeken activiteiten in de buurt…" : "Er wordt gewerkt aan de agenda voor deze plaats."}</T></strong><p><T>{"Kies een gemeente of bekijk de agenda voor Duras en omgeving."}</T></p></div><a className="text-arrow-link" href="#agenda"><T>{"Ontdek de agenda "}</T><span aria-hidden="true"><T>{"→"}</T></span></a></div>}</T>
      </section>



      <section className="area-explorer municipality-info-panel" id="gemeenten" aria-labelledby="area-heading">
        <div className="municipality-landscape" aria-hidden="true">
          <A><img src="/duras-landschapskaart.webp" alt="" width={1536} height={1024} loading="lazy" decoding="async" /></A>
        </div>
        <div className="area-explorer-copy municipality-info-copy">
          <p className="section-kicker"><T>{"Gemeentegids Côte de Duras en omgeving"}</T></p>
          <h2 id="area-heading"><T>{"Praktische informatie per gemeente."}</T></h2>
          <p><T>{"Kies een plaats en dienst voor contactgegevens, adressen en waar beschikbaar openingstijden. De lijst gebruikt de officiële Franse overheidsdirectory en actuele kaartgegevens."}</T></p>
        </div>
        <div className="municipality-directory">
          <p><a className="text-arrow-link" href="/gemeentegids/adverteren"><T>{"Voor ondernemers: bekijk adverteren in de gemeentegids →"}</T></a></p>
          <p><a className="text-arrow-link" href="/gemeentegids/aanmelden"><T>Bedrijf aanmelden in de gemeentegids →</T></a></p>
          <form className="municipality-service-controls" onSubmit={findMunicipalityServices}>
            <label className="field-label"><T>{"Gemeente of dorp "}</T><select className="municipality-select" value={municipalityAreaId} onChange={(event) => {
                setMunicipalityAreaId(event.target.value);
                setMunicipalityServiceInfo(null);
                setMunicipalitySearchComplete(false);
                setMunicipalityServicesError("");
              }}>
                <T>{renderAreaOptions()}</T>
              </select>
            </label>
            <label className="field-label"><T>{"Welke informatie zoek je? "}</T><select className="municipality-select" value={municipalityServiceType} onChange={(event) => {
                setMunicipalityServiceType(event.target.value as MunicipalityServiceType);
                setMunicipalityServiceInfo(null);
                setMunicipalitySearchComplete(false);
                setMunicipalityServicesError("");
              }}>
                <T>{[...municipalityServiceOptions].sort((a,b)=>a.id==="all"?-1:b.id==="all"?1:t(a.label).localeCompare(t(b.label),locale,{sensitivity:"base"})).map((option) => <option key={option.id} value={option.id}><T>{option.label}</T></option>)}</T>
              </select>
            </label>
            <button className="municipality-search-button" type="submit" disabled={municipalityServicesLoading}>
              <T>{municipalityServicesLoading ? "Informatie ophalen…" : "Toon informatie"}</T>
              <span aria-hidden="true"><T>{"→"}</T></span>
            </button>
          </form>
          <p className="municipality-data-note"><T>{"Kies ‘Alle categorieën’ om de diensten voor een gemeente tegelijk te bekijken. Officiële gemeentetellingen vullen de adressen aan. Resultaten buiten de gemeente tonen hun werkelijke plaats en afstand; ontbrekende adressen worden als ontbrekende broninformatie aangeduid."}</T></p>
          <T>{municipalityServicesError && <p className="municipality-feedback municipality-feedback-error" role="alert"><T>{municipalityServicesError}</T></p>}</T>
          <T>{municipalityServicesLoading && <p className="municipality-feedback" role="status"><T>{municipalityServiceType === "all" ? `We verzamelen nu alle gemeentelijke diensten voor ${municipalityName}, inclusief voorzieningen in de directe omgeving.` : `We zoeken ${municipalityServiceLabel.toLocaleLowerCase(intlLocale[locale])} ${municipalityServiceRadiusKm[municipalityServiceType] > 0 ? `in ${municipalityName} en tot ${municipalityServiceRadiusKm[municipalityServiceType]} km eromheen` : `in de gemeente ${municipalityName}`}.`}</T></p>}</T>
          <T>{municipalitySearchComplete && municipalityServiceType === "emergency" && (
            <div className={`municipality-result-layout${previewAdSamplesEnabled?' has-partners':''}`}>
              <div className="municipality-results municipality-emergency-results" aria-live="polite">
              <A><div className="emergency-number-grid" aria-label="Franse noodnummers">
                <T>{frenchEmergencyNumbers.map((item) => <article className="emergency-number-card" key={item.number}>
                  <A><a href={`tel:${item.number}`} aria-label={`Bel ${item.number}, ${item.name}`}><T>{item.number}</T></a></A>
                  <strong><T>{item.name}</T></strong>
                  <span><T>{item.note}</T></span>
                </article>)}</T>
                <p className="municipality-source-note"><T>{"Deze Franse noodnummers gelden ook in "}</T><T>{municipalityName}</T><T>{". "}</T><a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F33954" target="_blank" rel="noreferrer"><T>{"Officiële informatie van Service-Public"}</T></a><T>{"."}</T></p>
              </div></A>
              {previewAdSamplesEnabled&&<CoteDeDurasAdvertisement variant="municipal" placement="municipal" categoryName={municipalityServiceLabel}/>}
              </div>
              <MunicipalPartners listings={[]} city={municipalityName} previewAdSamplesEnabled={previewAdSamplesEnabled} categoryName={municipalityServiceLabel}/>
            </div>
          )}</T>
          <T>{municipalitySearchComplete && municipalityServiceType !== "emergency" && municipalityServiceInfo && (
            <div className={`municipality-result-layout${municipalityServiceInfo.municipalPartners?.length||previewAdSamplesEnabled?' has-partners':''}`}><div className="municipality-results" aria-live="polite">
              <T>{municipalityServiceType === "all" ? <>
                <T>{municipalityServiceGroupTypes.map((option) => {
                  if(option.id==="emergency")return (<section key="emergency" className="municipality-service-group municipality-emergency-group">
                  <div className="municipality-service-group-heading"><div><p className="section-kicker"><T>{"Geldt in heel Frankrijk"}</T></p><h3><T>{"Noodnummers"}</T></h3></div></div>
                  <A><div className="emergency-number-grid" aria-label={`Franse noodnummers voor ${municipalityName}`}>
                    <T>{frenchEmergencyNumbers.map((item) => <article className="emergency-number-card" key={item.number}>
                      <A><a href={`tel:${item.number}`} aria-label={`Bel ${item.number}, ${item.name}`}><T>{item.number}</T></a></A>
                      <strong><T>{item.name}</T></strong>
                      <span><T>{item.note}</T></span>
                    </article>)}</T>
                  </div></A>
                  <p className="municipality-source-note"><a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F33954" target="_blank" rel="noreferrer"><T>{"Officiële informatie van Service-Public"}</T></a><T>{"."}</T></p>
                  {previewAdSamplesEnabled&&<CoteDeDurasAdvertisement variant="municipal" placement="municipal" categoryName={option.label}/>}
                </section>);
                  const groupEntries = municipalityServiceEntries.filter((service) => service.type === option.id);
                  const equipmentCount = municipalityServiceInfo.officialEquipmentCounts?.find((item) => item.service === option.id);
                  const radius = municipalityServiceRadiusKm[option.id];
                  const localEntryCount = groupEntries.filter((entry) => entry.inSelectedMunicipality !== false).length;
                  const nearbyEntryCount = groupEntries.filter((entry) => entry.inSelectedMunicipality === false).length;
                  return <section className="municipality-service-group" key={option.id}>
                    <div className="municipality-service-group-heading"><div><p className="section-kicker"><T>{"Gemeentegids · "}</T><T>{municipalityName}</T></p><h3><T>{option.label}</T></h3></div><span><T>{groupEntries.length}</T><T>{" vermeldingen · "}</T><T>{groupEntries.filter(entry=>entry.image_url).length}</T><T>{" met foto"}</T></span></div>
                    <T>{equipmentCount && <p className="municipality-data-note"><strong><T>{"INSEE "}</T><T>{equipmentCount.year}</T><T>{":"}</T></strong> <T>{equipmentCount.basis}</T><T>{" De bronnen hieronder tonen "}</T><T>{localEntryCount}</T><T>{" concrete vermeldingen in "}</T><T>{municipalityName}</T><T>{nearbyEntryCount ? ` en ${nearbyEntryCount} in de omgeving` : ""}</T><T>{"."}</T><T>{localEntryCount < equipmentCount.count ? ` Voor ${equipmentCount.count - localEntryCount} voorzieningen kon nog geen afzonderlijk openbaar adres worden bevestigd.` : ""}</T></p>}</T>
                    <T>{groupEntries.length ? <div className="municipality-service-group-cards"><T>{groupEntries.map((entry, index) => renderMunicipalityServiceCard(entry, index, option.id))}</T></div> : <div className="municipality-empty-result">
                      <strong><T>{equipmentCount?.count ? `INSEE registreert ${equipmentCount.count} ${option.label.toLocaleLowerCase(intlLocale[locale])} in ${municipalityName}, maar de gekoppelde openbare adresbronnen geven op dit moment geen individuele vermeldingen terug.` : `Geen controleerbaar adres gevonden voor ${option.label.toLocaleLowerCase(intlLocale[locale])} ${radius > 0 ? `in ${municipalityName} of binnen ${radius} km` : `in ${municipalityName}`}.`}</T></strong>
                    <T>{equipmentCount && <p><T>{"De officiële telling geeft het aantal voorzieningen. Namen en adressen worden alleen getoond wanneer een openbare bron die per voorziening bevestigt."}</T></p>}</T>
                      <p><T>{"We vullen alleen namen en contactgegevens in wanneer een bron ze bevestigt."}</T></p>
                      <div className="municipality-service-links">
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${option.label} ${municipalityName}`)}`} target="_blank" rel="noreferrer"><T>{"Zoek op Google Maps "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>
                        <T>{option.id === "library" && <a href={municipalityLibrarySearchUrl} target="_blank" rel="noreferrer"><T>{"Bibliotheekregister van de BnF "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
                        <T>{option.id === "doctor" && <a href={municipalityDoctolibSearchUrl} target="_blank" rel="noreferrer"><T>{"Huisartsen op Doctolib "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
                        <a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${option.label} ${municipalityName}`)}`} target="_blank" rel="noreferrer"><T>{"OpenStreetMap "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>
                      </div>
                    </div>}</T>
                    {previewAdSamplesEnabled&&<CoteDeDurasAdvertisement variant="municipal" placement="municipal" categoryName={option.label}/>}
                  </section>;
                })}</T>

              </> : <>
                <T>{municipalityServiceInfo.officialEquipmentCount && <p className="municipality-data-note">
                  <strong><T>{"Officiële gemeentetelling ("}</T><T>{municipalityServiceInfo.officialEquipmentCount.year}</T><T>{"):"}</T></strong> <T>{municipalityServiceInfo.officialEquipmentCount.basis}</T><T>{" De bronnen hieronder tonen "}</T><T>{municipalityServiceEntries.filter((entry) => entry.inSelectedMunicipality !== false).length}</T><T>{" concrete vermeldingen in "}</T><T>{municipalityName}</T><T>{municipalityServiceEntries.filter((entry) => entry.inSelectedMunicipality === false).length ? ` en ${municipalityServiceEntries.filter((entry) => entry.inSelectedMunicipality === false).length} in de omgeving` : ""}</T><T>{"."}</T><T>{municipalityServiceEntries.filter((entry) => entry.inSelectedMunicipality !== false).length < municipalityServiceInfo.officialEquipmentCount.count ? ` Voor ${municipalityServiceInfo.officialEquipmentCount.count - municipalityServiceEntries.filter((entry) => entry.inSelectedMunicipality !== false).length} voorzieningen kon nog geen afzonderlijk openbaar adres worden bevestigd.` : ""}</T>
                </p>}</T>
                <T>{municipalityServiceEntries.length > 0 ? municipalityServiceEntries.map((entry, index) => renderMunicipalityServiceCard(entry, index, municipalityServiceType)) : <div className="municipality-empty-result">
                  <strong><T>{municipalityServiceInfo.officialEquipmentCount?.count ? `INSEE registreert ${municipalityServiceInfo.officialEquipmentCount.count} ${municipalityServiceLabel.toLocaleLowerCase(intlLocale[locale])} in ${municipalityName}, maar de gekoppelde openbare adresbronnen geven op dit moment geen individuele vermeldingen terug.` : `Geen ${municipalityServiceLabel.toLocaleLowerCase(intlLocale[locale])} gevonden ${municipalityServiceRadiusKm[municipalityServiceType] > 0 ? `in ${municipalityName} of binnen ${municipalityServiceRadiusKm[municipalityServiceType]} km` : `in ${municipalityName}`} in de beschikbare gegevens.`}</T></strong>
                  <p><T>{"Een lege vermelding betekent niet dat deze dienst niet bestaat. Bekijk de kaart of neem contact op met het gemeentehuis."}</T></p>
                  <div className="municipality-service-links">
                    <a href={municipalityMapSearchUrl} target="_blank" rel="noreferrer"><T>{"Zoek op Google Maps "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>
                    <T>{municipalityServiceType === "library" && <a href={municipalityLibrarySearchUrl} target="_blank" rel="noreferrer"><T>{"Zoek in het bibliotheekregister van de BnF "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
                    <T>{municipalityServiceType === "doctor" && <a href={municipalityDoctolibSearchUrl} target="_blank" rel="noreferrer"><T>{"Zoek huisartsen op Doctolib "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
                    <T>{municipalityServiceType === "physiotherapist" && <a href={municipalityPhysiotherapistSearchUrl} target="_blank" rel="noreferrer"><T>{"Zoek kinésithérapeutes op Doctolib "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
                    <T>{municipalityServiceType === "psychologist" && <a href={municipalityPsychologistSearchUrl} target="_blank" rel="noreferrer"><T>{"Zoek psychologues op Doctolib "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
                    <a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${municipalityServiceLabel} ${municipalityName}`)}`} target="_blank" rel="noreferrer"><T>{"OpenStreetMap "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>
                  </div>
                </div>}</T>
                {previewAdSamplesEnabled&&<CoteDeDurasAdvertisement variant="municipal" placement="municipal" categoryName={municipalityServiceLabel}/>}
              </>}</T>
              <p className="municipality-source-note"><T>{"Geraadpleegd op "}</T><T>{new Date(municipalityServiceInfo.updatedAt).toLocaleDateString(intlLocale[locale])}</T><T>{". "}</T><T>{municipalityServiceInfo.sources?.length ? <><T>{" Controleer ook deze aanvullende bronnen:"}</T><T>{municipalityServiceInfo.sources.map((source) => <span key={source.url}> <a href={safeHttpUrl(source.url) ?? "#"} target="_blank" rel="noreferrer"><T>{source.name}</T> <span aria-hidden="true"><T>{"↗"}</T></span></a><T>{"."}</T></span>)}</T></> : null}</T>
                <T>{municipalityServiceType !== "mairie" && municipalityServiceEntries.some((service) => service.sourceName === "OpenStreetMap") && municipalityServiceInfo.mapDataAvailable && <><T>{" Aanvullende kaartgegevens: © OpenStreetMap-bijdragers."}</T></>}</T>
              </p>
              <T>{!municipalityServiceInfo.mapDataAvailable && !municipalityServiceInfo.curatedDataAvailable && <p className="municipality-feedback municipality-feedback-error"><T>{"De kaartgegevens zijn tijdelijk niet bereikbaar. De links naar Google Maps en Doctolib blijven beschikbaar."}</T></p>}</T>
              <T>{!municipalityServiceInfo.mapDataAvailable && municipalityServiceInfo.curatedDataAvailable && <p className="municipality-data-note"><T>{"De officiële vermeldingen hierboven zijn beschikbaar. De aanvullende OpenStreetMap-resultaten zijn tijdelijk niet bereikbaar."}</T></p>}</T>
            </div><MunicipalPartners listings={municipalityServiceInfo.municipalPartners??[]} city={municipalityName} previewAdSamplesEnabled={previewAdSamplesEnabled} categoryName={municipalityServiceType==='all'?undefined:municipalityServiceLabel}/></div>
          )}</T>
        </div>
      </section>

      <div className="visitor-guides"><PaidListingsCarousel /></div>

      <T>{listingContent}</T>

      <AnalyticsConsent disabled={isAdmin || authLoading} />
      <SocialLinks />
      <footer className="site-footer">
        <A><a className="brand-lockup footer-brand" href="#top" aria-label="Terug naar boven">
          <span className="brand-mark" aria-hidden="true"><A><img src="/cote-de-duras-logo.webp" alt="" width={240} height={180} loading="lazy" decoding="async" /></A></span>
          <span className="brand-name"><strong><T>{"CÔTE DE DURAS"}</T></strong><small><T>{"Evenementen en informatie binnen 50 kilometer"}</T></small></span>
        </a></A>
        <div><a href="#agenda"><T>{"Agenda"}</T></a><a href="#gemeenten"><T>{"Gemeenten"}</T></a><a href="/disclaimer"><T>{"Disclaimer"}</T></a><a href="/contact"><T>{"Contactgegevens"}</T></a><a href="/handleiding"><T>{"Handleiding"}</T></a><a href="/mijn-vermelding"><T>Vermelding toevoegen / beheren</T></a><button className="footer-admin-link" type="button" onClick={() => { const panel = document.getElementById("beheer") as HTMLDetailsElement | null; if (panel) { panel.open = true; panel.scrollIntoView({ behavior: "smooth", block: "start" }); } }}><T>{"Beheerderslogin"}</T></button></div>
        <span className="footer-note"><T>{"Een streek vol verhalen, ontmoetingen en kleine ontdekkingen."}</T></span>
      </footer>

      <details id="beheer" onToggle={(event) => { if (event.currentTarget.open) setAdminContentMounted(true); }} style={{ margin: "28px 0", padding: 16, background: "#f8fafc", border: "1px solid #d8dee8", borderRadius: 10 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}><T>{"Beheerdersdashboard"}</T></summary>
      <T>{adminContentMounted && <>
      <h2><T>{"Beheerdersdashboard"}</T></h2>

      <T>{authLoading ? (
        <p><T>{"Inlogstatus controleren..."}</T></p>
      ) : user ? (
        <p><T>{"Ingelogd als "}</T><strong><T preserve>{user.email}</T></strong><T>{" "}</T>
          <button type="button" onClick={() => void signOut()}><T>{"Uitloggen"}</T></button>
        </p>
      ) : (
        <form onSubmit={signIn} style={{ display: "grid", gap: 12, maxWidth: 420, padding: 18, margin: "16px 0", background: "white", border: "1px solid #d8dee8", borderRadius: 10 }}>
          <h3 style={{ margin: 0 }}><T>{"Beheerderslogin"}</T></h3>
          <label style={labelStyle}><T>{"E-mailadres "}</T><input style={inputStyle} type="email" autoComplete="username" required value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
          </label>
          <label style={labelStyle}><T>{"Wachtwoord "}</T><input style={inputStyle} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" style={{ padding: 12, border: 0, borderRadius: 8, background: "#173f5f", color: "white", cursor: "pointer" }}><T>{"Inloggen "}</T></button>
          <p style={{ margin: 0, color: "#64748b" }}><T>{"Gebruik het wachtwoord van je Database 47-account."}</T></p>
        </form>
      )}</T>

      <T>{!authLoading && user && isAdmin && <>
      <CalendarSiteSwitcher currentSite="duras"/>
      <AnalyticsDashboard client={supabase} />
      <MunicipalBusinessAdmin client={supabase}/><AdvertisingRequests onListingArchived={()=>void loadData(true)} client={supabase}/><ListingRequestsAdmin client={supabase}/><MailSettings client={supabase}/>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          margin: "20px 0",
        }}
      >
        <T>{[
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
            <div style={{ fontSize: 14, color: "#64748b" }}><T>{label}</T></div>
            <strong style={{ fontSize: 27 }}><T>{count}</T></strong>
          </div>
        ))}</T>
      </div>

      <h2><T>{"Databaseverbinding"}</T></h2>
      <p>
        <T>{supabase
          ? `${categories.length} categorieën en ${events.length} evenementen geladen.`
          : "Supabase-instellingen ontbreken."}</T>
      </p>

      <T>{error && (
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
          <T>{error}</T>
        </p>
      )}</T>

      <T>{message && (
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
          <T>{message}</T>
        </p>
      )}</T>

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
        ><T>{"Een nieuw evenement/vermelding "}</T></button>

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
          <T>{refreshing?'Gegevens vernieuwen…':'Vernieuwen'}</T>
        </button>
        <T>{isAdmin && <>
          <button type="button" onClick={()=>void previewEventSource('all','Alle agendabronnen')} disabled={importLoading||importing} aria-busy={activeImport==='all'} style={{padding:'12px 18px',border:'1px solid #315c4b',borderRadius:8,background:'#315c4b',color:'white',fontSize:15}}><T>{activeImport==='all'?'Alle bronnen ophalen…':'Alles verversen'}</T></button>
          <T>{IMPORT_SOURCES.map(source=><button key={source.endpoint} type="button" onClick={()=>void previewEventSource(source.endpoint,source.name)} disabled={importLoading||importing} aria-busy={activeImport===source.endpoint} style={{padding:'12px 18px',border:'1px solid #cbd5e1',borderRadius:8,background:'white',fontSize:15}}><T>{activeImport===source.endpoint?source.name+' ophalen…':source.name+' importeren'}</T></button>)}</T>
          <p style={{width:'100%',margin:0}}><T>{"Vernieuwen laadt de opgeslagen gegevens opnieuw. Kies één import om alleen die bron op te halen. Alles verversen haalt alle agendabronnen op. Controleer daarna de voorvertoning voordat je de import opslaat."}</T></p>
        </>}</T>
        <T>{isAdmin && (
          <button
            type="button"
            onClick={() => {
              setShowSocialPostForm((open) => !open);
              setSocialPostError("");
            }}
            disabled={importing}
            style={{ padding: "12px 18px", border: "1px solid #cbd5e1", borderRadius: 8, background: "white", cursor: importing ? "wait" : "pointer", fontSize: 15 }}
          >
            <T>{showSocialPostForm ? "Sociale post sluiten" : "Sociale post voorvertonen"}</T>
          </button>
        )}</T>
      </div>

      <T>{isAdmin && showSocialPostForm && (
        <A><section aria-label="Sociale post klaarzetten voor voorvertoning" style={{ display: "grid", gap: 14, margin: "18px 0 24px", padding: 20, border: "1px solid #d8dee8", borderRadius: 12, background: "#fff" }}>
          <div>
            <h3 style={{ margin: "0 0 8px" }}><T>{"Facebook- of Instagrambericht bekijken"}</T></h3>
            <p style={{ margin: 0, color: "#52616f", lineHeight: 1.55 }}><T>{"Plak de link en de tekst van één specifiek bericht. Besloten groepsberichten kunnen niet automatisch door de agenda worden uitgelezen; daarom lever je hier zelf het bericht aan. De app vraagt niet om je Facebook-wachtwoord en logt niet namens jou in. De datum kan uit de tekst worden voorgesteld, maar controleer datum en tijd altijd. De volledige berichttekst wordt als beschrijving opgeslagen. De foto verschijnt alleen als je ook een directe fotolink invult. "}</T></p>
          </div>
          <label style={labelStyle}><T>{"Link naar het oorspronkelijke bericht (niet alleen de groepslink) * "}</T><A><input style={inputStyle} type="url" value={socialPostUrl} onChange={(event) => setSocialPostUrl(event.target.value)} placeholder="https://www.facebook.com/groups/.../posts/..." /></A>
            <span style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 13, fontWeight: 400 }}><T>{"Open een bericht in de groep en klik op de datum of tijd ervan om de link van dat bericht te kopiëren."}</T></span>
          </label>
          <label style={labelStyle}><T>{"Berichttekst * "}</T><A><textarea style={{ ...inputStyle, minHeight: 130, resize: "vertical" }} value={socialPostText} onChange={(event) => setSocialPostText(event.target.value)} placeholder="Plak de tekst van het bericht hier" /></A>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label style={labelStyle}><T>{"Evenementtitel * "}</T><A><input style={inputStyle} maxLength={180} value={socialPostTitle} onChange={(event) => setSocialPostTitle(event.target.value)} placeholder="Titel zoals die in de agenda mag staan" /></A>
            </label>
            <label style={labelStyle}><T>{"Plaats * "}</T><A><input style={inputStyle} value={socialPostCity} onChange={(event) => setSocialPostCity(event.target.value)} placeholder="Duras, Eymet, Marmande…" /></A>
            </label>
            <label style={labelStyle}><T>{"Begindatum en -tijd * "}</T><input style={inputStyle} type="datetime-local" value={socialPostStartAt} onChange={(event) => setSocialPostStartAt(event.target.value)} />
            </label>
            <label style={labelStyle}><T>{"Einddatum en -tijd (optioneel) "}</T><input style={inputStyle} type="datetime-local" value={socialPostEndAt} onChange={(event) => setSocialPostEndAt(event.target.value)} />
            </label>
            <label style={labelStyle}><T>{"Locatie (optioneel) "}</T><A><input style={inputStyle} value={socialPostVenue} onChange={(event) => setSocialPostVenue(event.target.value)} placeholder="Bijvoorbeeld Salle des fêtes" /></A>
            </label>
            <label style={labelStyle}><T>{"Fotolink (optioneel) "}</T><A><input style={inputStyle} type="url" value={socialPostImageUrl} onChange={(event) => setSocialPostImageUrl(event.target.value)} placeholder="https://…" /></A>
            </label>
            <label style={labelStyle}><T>{"Categorie * "}</T><select style={inputStyle} value={socialPostCategoryId} onChange={(event) => setSocialPostCategoryId(event.target.value)}>
                <option value=""><T>{"Kies een categorie"}</T></option>
                <T>{categories.map((category) => <option key={category.id} value={category.id}><T>{category.name ?? category.slug ?? "Activiteit"}</T></option>)}</T>
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
            ><T>{"Datum uit bericht halen "}</T></button>
            <button type="button" onClick={previewSocialPost} disabled={importing || categories.length === 0} style={{ padding: "10px 14px", border: 0, borderRadius: 7, background: "#173f5f", color: "white", cursor: importing ? "wait" : "pointer", fontWeight: 700 }}><T>{"Maak voorvertoning "}</T></button>
          </div>
          <T>{categories.length === 0 && <p role="alert" style={{ margin: 0, color: "#9f1239" }}><T>{"De categorieën zijn nog niet geladen. Vernieuw de beheerderstool voordat je verdergaat."}</T></p>}</T>
          <T>{socialPostError && <p role="alert" style={{ margin: 0, padding: 12, background: "#fff1f2", color: "#9f1239", borderRadius: 8 }}><T>{socialPostError}</T></p>}</T>
        </section></A>
      )}</T>

      <T>{importNotice && (
        <A><section className="import-preview" aria-label={`Voorvertoning ${importSourceName}`}>
          <div className="import-preview-heading">
            <span className="import-preview-kicker"><T>{"Importvoorvertoning"}</T></span>
            <h3><T>{importSourceName}</T></h3>
            <p role="status"><T>{importNotice}</T></p>
            <p><T>Geselecteerde bronimports worden automatisch goedgekeurd. Handmatig aangeleverde sociale berichten blijven wachten op controle. De bronlink blijft bewaard; aanpassen kan via BEWERKEN.</T></p>
          </div>
          <T>{categories.length === 0 && <p role="alert" style={{ color: "#9f1239" }}><T>{"Er zijn geen categorieën geladen. Importeer nog niet; de categorieën moeten eerst in deze database beschikbaar zijn."}</T></p>}</T>
          <T>{importPreview.length > 0 && (
            <button
              type="button"
              onClick={() => void importTourismeDuras()}
              disabled={importing || !isAdmin || categories.length === 0}
              style={{ marginBottom: 14, padding: "12px 18px", border: 0, borderRadius: 8, background: importing ? "#94a3b8" : "#16734b", color: "white", cursor: importing ? "wait" : "pointer", fontSize: 15 }}
            >
              <T>{importing ? "Importeren..." : `Importeer ${importPreview.length} activiteiten`}</T>
            </button>
          )}</T>
          <div className="import-preview-list">
            <T>{importPreview.slice(0, importPreviewLimit).map((event) => (
              <article className="import-event-card" key={event.source_url}>
                <T>{safeHttpUrl(event.image_url) ? <A><img className="import-event-image" src={safeHttpUrl(event.image_url)!} alt={`Foto bij ${event.title}`} loading="lazy" /></A> : <A><div className="import-event-image import-event-image-placeholder" aria-label="Geen evenementfoto op de beschikbare bronpagina"><span><T>{"Foto niet gevonden"}</T></span></div></A>}</T>
                <div className="import-event-content">
                  <div className="import-event-topline"><span className="import-status-pill"><T>{"Voorbeeld — nog niet opgeslagen"}</T></span><T>{event.source_category && <span className="import-source-category"><T>{event.source_category}</T></span>}</T></div>
                  <h4><T preserve>{event.title}</T></h4>
                  <p className="import-event-date"><T>{formatDate(event.start_at)}</T><T>{event.end_at ? ` t/m ${formatDate(event.end_at)}` : ""}</T></p>
                  <p className="import-event-place"><T>{[event.venue_name, event.address, event.postcode, event.city].filter(Boolean).join(", ") || event.city || "Adres niet op de bronpagina gevonden"}</T></p>
                  <T>{(event.short_description || event.description) && <p className="import-event-description"><T>{event.short_description || event.description}</T></p>}</T>
                  <div className="import-event-meta">
                    <T>{event.contact_phone && <span><T>{"Tel. "}</T><T preserve>{event.contact_phone}</T></span>}</T>
                    <T>{publicEventUrl(event.website_url) && <a data-analytics-channel="website" href={publicEventUrl(event.website_url)!} target="_blank" rel="noreferrer"><T>{event.source_url.includes("eymet-dordogne.fr") ? "Aanvullende evenementpagina" : "Website organisator"}</T></a>}</T>
                    <T>{publicEventUrl(event.booking_url) && <a data-analytics-channel="booking" href={publicEventUrl(event.booking_url)!} target="_blank" rel="noreferrer"><T>{"Reserveren"}</T></a>}</T>
                  </div>
                  <p className="import-category-suggestion"><strong><T>{"Voorgestelde categorie:"}</T></strong> <T>{categories.find((category) => category.id === event.category_id)?.name ?? "Nog te bepalen"}</T><T>{". Je kunt deze na import wijzigen via BEWERKEN."}</T></p>
                  <a className="import-source-link" href={event.source_url} target="_blank" rel="noreferrer"><T>{"Oorspronkelijke bron bekijken ↗ "}</T><span><T>{sourceLabel(event.source_url)}</T></span></a>
                </div>
              </article>
            ))}</T>
          </div>
        </section></A>
      )}</T>

      <T>{importPreview.length > importPreviewLimit && <button type="button" onClick={() => setImportPreviewLimit(count => count + 60)}><T>{"Toon meer importvoorbeelden ("}</T><T>{importPreview.length - importPreviewLimit}</T><T>{" resterend)"}</T></button>}</T>
      <h2 id="admin-results-heading"><T>{"Evenementen beheren"}</T></h2>

      <T>{(() => {
        const pendingEvents = events.filter((event) => event.status?.toLowerCase() === "pending");
        const pendingImportCount=events.filter(isPendingImport).length;
        const results=searchAdminEvents(events,adminEventSearch,adminCategoryFilter,adminEventFilter,adminEventPage);
        return <>
          <A><div role="group" aria-label="Filter evenementen" style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "12px 0 18px" }}>
            <button
              type="button"
              aria-pressed={adminEventFilter === "pending"}
              onClick={() => { setAdminEventFilter("pending"); setAdminEventPage(1); }}
              style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 7, background: adminEventFilter === "pending" ? "#173f5f" : "white", color: adminEventFilter === "pending" ? "white" : "#172033", cursor: "pointer", fontWeight: 700 }}
            ><T>{"Wacht op controle ("}</T><T>{pendingEvents.length}</T><T>{") "}</T></button>
            <button
              type="button"
              aria-pressed={adminEventFilter === "all"}
              onClick={() => { setAdminEventFilter("all"); setAdminEventPage(1); }}
              style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 7, background: adminEventFilter === "all" ? "#173f5f" : "white", color: adminEventFilter === "all" ? "white" : "#172033", cursor: "pointer", fontWeight: 700 }}
            ><T>{"Alle evenementen ("}</T><T>{events.length}</T><T>{") "}</T></button>
          </div></A>
          <div style={{padding:14,marginBottom:16,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8}}>
            <button type="button" aria-expanded={bulkApprovalCandidates!==null} aria-controls="bulk-import-confirmation" disabled={loading||bulkApproving||importing||updatingEventId!==null||pendingImportCount===0} onClick={()=>{setBulkApprovalNotice('');setBulkApprovalError('');setBulkApprovalCandidates(events.filter(isPendingImport));}} style={{padding:'10px 14px',border:0,borderRadius:7,background:'#16734b',color:'white',fontWeight:700}}><T>{bulkApproving?'Imports worden goedgekeurd…':`Alle imports goedkeuren (${pendingImportCount})`}</T></button>
            <p style={{margin:'8px 0 0'}}><T>{"Keur alle wachtende imports goed, in alle categorieën en op alle pagina’s. De vermeldingen worden openbaar zichtbaar. Handmatige inzendingen blijven apart ter controle."}</T></p>
            {bulkApprovalCandidates&&<div id="bulk-import-confirmation" role="group" aria-labelledby="bulk-import-confirmation-title" style={{padding:16,marginTop:12,border:'1px solid #16734b',borderRadius:8,background:'white'}}>
              <h3 id="bulk-import-confirmation-title" style={{marginTop:0}}><T>{"Imports openbaar maken"}</T></h3>
              <p><T>{`Je gaat ${bulkApprovalCandidates.length} wachtende imports goedkeuren. Dit geldt voor alle categorieën en alle pagina’s, ook buiten je zoekfilters. Handmatige inzendingen blijven ter controle.`}</T></p>
              <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
                <button type="button" ref={bulkApprovalCancel} onClick={()=>setBulkApprovalCandidates(null)}><T>{"Annuleren"}</T></button>
                <button type="button" disabled={loading||bulkApproving||importing||updatingEventId!==null} onClick={()=>void approveAllImports()} style={{padding:'10px 14px',border:0,borderRadius:7,background:'#16734b',color:'white',fontWeight:700}}><T>{`Ja, keur ${bulkApprovalCandidates.length} imports goed`}</T></button>
              </div>
            </div>}
            {!pendingImportCount&&!bulkApproving&&!bulkApprovalNotice&&<p role="status"><T>{"Er staan geen imports meer klaar om goed te keuren."}</T></p>}
            <T>{bulkApprovalNotice&&<p role="status" aria-live="polite"><T>{bulkApprovalNotice}</T></p>}</T>
            {bulkApprovalError&&<p role="alert" style={{color:'#9f1239'}}><T>{bulkApprovalError}</T></p>}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:14,alignItems:'end',marginBottom:16}}>
            <label style={{...labelStyle,flex:'1 1 240px'}}><T>{"Zoek op naam "}</T><A><input type="search" style={inputStyle} value={adminEventSearch} placeholder="Bijvoorbeeld Château of Café de la place" onChange={e=>{setAdminEventSearch(e.target.value);setAdminEventPage(1);}} /></A>
            </label>
            <label style={{...labelStyle,flex:'1 1 240px'}}><T>{"Categorie in beheer "}</T><select style={inputStyle} value={adminCategoryFilter} onChange={e=>{setAdminCategoryFilter(e.target.value);setAdminEventPage(1);}}>
                <option value="all"><T>{"Alle categorieën"}</T></option><option value="none"><T>{"Nog niet ingedeeld"}</T></option>
                <T>{categories.map(category=><option key={category.id} value={category.id}><T>{category.name??category.slug}</T></option>)}</T>
              </select>
            </label>
            <button type="button" onClick={()=>{setAdminEventSearch('');setAdminCategoryFilter('all');setAdminEventPage(1);}}><T>{"Zoekfilters wissen"}</T></button>
          </div>
          <T>{!loading&&<p role="status" aria-live="polite"><T>{results.total}</T> <T>{results.total===1?'resultaat':'resultaten'}</T><T>{" · "}</T><T>{results.total?`${results.from}–${results.to} getoond · pagina ${results.page} van ${results.pages}`:'pas de naam, categorie of status aan'}</T></p>}</T>
          <T>{!loading && results.total === 0 && (
            <p role="status" style={{ padding: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534" }}><T>{"Geen vermeldingen gevonden met deze combinatie van naam, categorie en status. "}</T></p>
          )}</T>

      <T>{loading && <p><T>{"Gegevens laden..."}</T></p>}</T>

      <T>{!loading && events.length === 0 && (
        <p><T>{"Er zijn nog geen evenementen opgeslagen."}</T></p>
      )}</T>

      <T>{results.items.map((event) => (
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
          <h3><T preserve={event.is_directory_entry===true}>{event.title}</T></h3>
          <T>{savedEventId === event.id && editingEventId !== event.id && (
            <p role="status" aria-live="polite" style={{ padding: 10, background: "#ecfdf5", color: "#065f46", borderRadius: 8 }}><T>{"Wijzigingen opgeslagen. Het bewerkingsvenster is gesloten. "}</T></p>
          )}</T>
          <T>{safeHttpUrl(event.image_url) && <A><img src={safeHttpUrl(event.image_url)!} alt={event.title} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 8, marginBottom: 12 }} /></A>}</T>
          <p><strong><T>{"Categorie:"}</T></strong> <T>{event.category_ids?.map(id=>categories.find(c=>c.id===id)?.name).filter(Boolean).join(', ') || event.category_name || "Nog niet ingedeeld"}</T></p>
          <p><T>{formatDate(event.start_at)}</T><T>{event.end_at ? ` t/m ${formatDate(event.end_at)}` : ""}</T></p>
          <T>{(event.venue_name || event.address || event.postcode || event.city) && (
            <p><T preserve>{[event.venue_name, event.address, event.postcode, event.city].filter(Boolean).join(", ")}</T></p>
          )}</T>
          <T>{event.contact_phone && <p><T>{"Telefoon: "}</T><a href={`tel:${event.contact_phone.replace(/[^+\d]/g, "")}`}><T preserve>{event.contact_phone}</T></a></p>}</T>
          <T>{event.is_manual_entry && <div><button type="button" onClick={()=>void createOwnerLink(event)}><T>{"Persoonlijke beheerlink voor inzender maken"}</T></button><T>{managementLink.includes(event.id+":")&&<label><T>{"Alleen delen met de geverifieerde inzender"}</T><input style={inputStyle} readOnly value={managementLink} onFocus={e=>e.target.select()}/></label>}</T></div>}</T>
          <T>{publicEventUrl(event.website_url) && <p><a data-analytics-channel="website" href={publicEventUrl(event.website_url)!} target="_blank" rel="noreferrer"><T>{"Website"}</T></a></p>}</T>
          <T>{publicEventUrl(event.booking_url) && <p><a data-analytics-channel="booking" href={publicEventUrl(event.booking_url)!} target="_blank" rel="noreferrer"><T>{"Reserveren"}</T></a></p>}</T>
          <T>{event.source_category && <p><T>{"Type bij bron: "}</T><T>{event.source_category}</T></p>}</T>
          <T>{event.organizer_name && <p><T>{"Organisator: "}</T><T>{event.organizer_name}</T></p>}</T>
          <T>{event.source_url && <p><T>{"Bron: "}</T><T>{sourceLabel(event.source_url)}</T></p>}</T>
          <T>{safeHttpUrl(event.source_url) && <p><a data-analytics-channel="source" href={safeHttpUrl(event.source_url)!} target="_blank" rel="noreferrer"><T>{"Bronpagina"}</T></a></p>}</T>
          <T>{event.short_description && <p><T>{event.short_description}</T></p>}</T>
          <T>{event.description && <p><T>{event.description}</T></p>}</T>
          <p><T>{"Status:"}</T><T>{" "}</T>
            <T>{event.status === "pending"
              ? "In afwachting van controle"
              : event.status === "rejected"
                ? "Afgewezen"
              : event.status ?? "Onbekend"}</T>
          </p>
          <T>{event.promotion_type && event.promotion_type !== "none" && <div className="admin-promotion-request">
            <p><strong><T>{"Promotieaanvraag:"}</T></strong> <T>{event.promotion_type === "homepage" ? "Homepage" : event.promotion_type === "category" ? "Categorie" : "Omkaderde vermelding"}</T><T>{" · "}</T><T>{event.promotion_status === "active" ? "actief" : event.promotion_status === "ended" ? "beëindigd" : "in behandeling — controleer de betaalstatus bij Advertentieaanvragen"}</T></p>
            <T>{event.advertiser_email && <p><T>{"Contact adverteerder: "}</T><a href={`mailto:${event.advertiser_email}`}><T>{event.advertiser_email}</T></a></p>}</T>
            <T>{isAdmin && event.promotion_status !== "active" && event.promotion_status !== "ended" && event.status === "approved" && event.verified === true && <button type="button" disabled={bulkApproving || updatingEventId === event.id} onClick={() => void setPromotionStatus(event, "active")}><T>{"Activeer na betaalbevestiging"}</T></button>}</T>
            <T>{isAdmin && event.promotion_status !== "active" && event.promotion_status !== "ended" && (event.status !== "approved" || event.verified !== true) && <p><T>{"De vermelding wacht op inhoudelijke goedkeuring. De betaalstatus staat apart bij Advertentieaanvragen & factuurgegevens; Mollie bevestigt betalingen automatisch."}</T></p>}</T>
            <T>{isAdmin && event.promotion_status === "active" && <button type="button" disabled={bulkApproving || updatingEventId === event.id} onClick={() => void setPromotionStatus(event, "ended")}><T>{"Promotie stoppen"}</T></button>}</T>
          </div>}</T>

          <T>{isAdmin && editingEventId !== event.id && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button type="button" disabled={bulkApproving} onClick={() => beginEdit(event)} style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 7, background: "white", cursor: "pointer" }}><T>{"BEWERKEN "}</T></button>
              <T>{event.status?.toLowerCase() === "pending" && <button
                type="button"
                disabled={bulkApproving || updatingEventId === event.id}
                onClick={() => void setEventStatus(event, "approved")}
                style={{ padding: "10px 14px", border: 0, borderRadius: 7, background: updatingEventId === event.id ? "#94a3b8" : "#16734b", color: "white", cursor: updatingEventId === event.id ? "wait" : "pointer" }}
              >
                <T>{updatingEventId === event.id ? "Bezig..." : "GOEDKEUREN"}</T>
              </button>}</T>
              <button
                type="button"
                disabled={bulkApproving || updatingEventId === event.id}
                onClick={() => void deleteEvent(event)}
                style={{ padding: "10px 14px", border: "1px solid #fecaca", borderRadius: 7, background: "white", color: "#b91c1c", cursor: updatingEventId === event.id ? "wait" : "pointer" }}
              >
                <T>{updatingEventId === event.id ? "Verwijderen…" : "VERWIJDEREN"}</T>
              </button>
            </div>
          )}</T>

          <T>{event.is_free ? (
            <p><T>{"Gratis"}</T></p>
          ) : event.price_from != null ? (
            <p><T>{"Vanaf €"}</T><T>{Number(event.price_from).toFixed(2)}</T>
              <T>{event.price_to != null
                ? ` tot €${Number(event.price_to).toFixed(2)}`
                : ""}</T>
            </p>

          ) : null}</T>

          <T>{isAdmin && editingEventId === event.id && editDraft && (
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
              <h3 style={{ margin: 0 }}><T>{"Evenement bewerken"}</T></h3>

              <label style={labelStyle}><T>{"Titel * "}</T><input
                  style={inputStyle}
                  required
                  value={editDraft.title}
                  onChange={(e) => updateEditDraft("title", e.target.value)}
                />
              </label>

              <label style={labelStyle}><T>{"Categorie "}</T><select
                  style={inputStyle}
                  value={editDraft.category_id}
                  onChange={(e) => updateEditDraft("category_id", e.target.value)}
                  disabled={categories.length === 0}
                >
                  <option value=""><T>{"Kies een categorie"}</T></option>
                  <T>{categories.map((category) => (
                    <option key={category.id} value={category.id}><T>{category.name ?? category.slug ?? "Categorie"}</T></option>
                  ))}</T>
                </select>
              </label>

              <label style={labelStyle}><T>{"Korte beschrijving "}</T><input
                  style={inputStyle}
                  maxLength={250}
                  value={editDraft.short_description}
                  onChange={(e) => updateEditDraft("short_description", e.target.value)}
                />
              </label>

              <label style={labelStyle}><T>{"Uitgebreide beschrijving "}</T><textarea
                  style={{ ...inputStyle, minHeight: 100 }}
                  value={editDraft.description}
                  onChange={(e) => updateEditDraft("description", e.target.value)}
                />
              </label>

              <label style={labelStyle}><T>{"Foto van het evenement "}</T><T>{safeHttpUrl(event.image_url) && !editPhotoPreview && (
                  <A><img src={safeHttpUrl(event.image_url)!} alt={`Huidige foto bij ${event.title}`} loading="lazy" style={{ display: "block", width: "min(100%, 360px)", maxHeight: 240, objectFit: "cover", borderRadius: 8, margin: "8px 0" }} /></A>
                )}</T>
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
                <span style={{ display: "block", marginTop: 6, color: "#64748b", fontWeight: 400 }}><T>{"Kies een JPG-, PNG- of WebP-foto van maximaal 5 MB. Een nieuwe foto vervangt de huidige foto."}</T></span>
                <T>{editPhotoPreview && <A><img src={editPhotoPreview} alt="Voorbeeld van de nieuwe evenementfoto" style={{ display: "block", width: "min(100%, 360px)", maxHeight: 240, objectFit: "cover", borderRadius: 8, marginTop: 10 }} /></A>}</T>
              </label>

              <label style={labelStyle}>
                <T>{event.is_directory_entry?'Vaste vermelding — geen evenementdatum':'Begindatum en -tijd *'}</T>
                <input
                  style={inputStyle}
                  type="datetime-local"
                  required
                  disabled={event.is_directory_entry}
                  value={editDraft.start_at}
                  onChange={(e) => updateEditDraft("start_at", e.target.value)}
                />
              </label>

              <label style={labelStyle}><T>{"Einddatum en -tijd "}</T><input
                  style={inputStyle}
                  type="datetime-local"
                  disabled={event.is_directory_entry}
                  value={editDraft.end_at}
                  onChange={(e) => updateEditDraft("end_at", e.target.value)}
                />
              </label>

              <label style={labelStyle}><T>{"Locatie / zaal "}</T><input
                  style={inputStyle}
                  value={editDraft.venue_name}
                  onChange={(e) => updateEditDraft("venue_name", e.target.value)}
                />
              </label>

              <label style={labelStyle}><T>{"Adres "}</T><input
                  style={inputStyle}
                  value={editDraft.address}
                  onChange={(e) => updateEditDraft("address", e.target.value)}
                />
              </label>

              <label style={labelStyle}><T>{"Postcode "}</T><input
                  style={inputStyle}
                  value={editDraft.postcode}
                  onChange={(e) => updateEditDraft("postcode", e.target.value)}
                />
              </label>

              <label style={labelStyle}><T>{"Plaats "}</T><input
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
                /><T>{"Dit evenement is gratis "}</T></label>

              <T>{!editDraft.is_free && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 12,
                  }}
                >
                  <label style={labelStyle}><T>{"Prijs vanaf (€) "}</T><input
                      style={inputStyle}
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDraft.price_from}
                      onChange={(e) => updateEditDraft("price_from", e.target.value)}
                    />
                  </label>
                  <label style={labelStyle}><T>{"Prijs tot (€) "}</T><input
                      style={inputStyle}
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDraft.price_to}
                      onChange={(e) => updateEditDraft("price_to", e.target.value)}
                    />
                  </label>
                </div>
              )}</T>

              <label style={labelStyle}><T>{"Website "}</T><input
                  style={inputStyle}
                  type="text"
                  inputMode="url"
                  value={editDraft.website_url}
                  onChange={(e) => updateEditDraft("website_url", e.target.value)}
                />
              </label>

              <label style={labelStyle}><T>{"Reserveringslink "}</T><input
                  style={inputStyle}
                  type="text"
                  inputMode="url"
                  value={editDraft.booking_url}
                  onChange={(e) => updateEditDraft("booking_url", e.target.value)}
                />
              </label>

              <label style={labelStyle}><T>{"Bronlink "}</T><input
                  style={inputStyle}
                  type="text"
                  inputMode="url"
                  value={editDraft.source_url}
                  onChange={(e) => updateEditDraft("source_url", e.target.value)}
                />
              </label>

              <T>{editError && (
                <p role="alert" aria-live="assertive" style={{ margin: 0, padding: 12, background: "#fff1f2", color: "#9f1239", borderRadius: 8, overflowWrap: "anywhere" }}>
                  <T>{editError}</T>
                </p>
              )}</T>

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
                  <T>{updatingEventId === event.id ? "Opslaan..." : "Wijzigingen opslaan"}</T>
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
                ><T>{"Annuleren "}</T></button>
              </div>
            </form>
          )}</T>
        </article>

      ))}</T>
          <T>{results.pages>1&&<A><nav aria-label="Pagina’s beheerresultaten" style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',margin:'20px 0'}}>
            <button type="button" disabled={results.page<=1} onClick={()=>{setAdminEventPage(results.page-1);document.getElementById('admin-results-heading')?.scrollIntoView({behavior:'smooth'});}}><T>{"Vorige pagina"}</T></button>
            <span><T>{"Pagina "}</T><T>{results.page}</T><T>{" van "}</T><T>{results.pages}</T></span>
            <button type="button" disabled={results.page>=results.pages} onClick={()=>{setAdminEventPage(results.page+1);document.getElementById('admin-results-heading')?.scrollIntoView({behavior:'smooth'});}}><T>{"Volgende pagina"}</T></button>
          </nav></A>}</T>
        </>;
      })()}</T>
      </>}</T>
      </>}</T>
      </details>
      <T>{selectedVisitorEvent && typeof document !== "undefined" && createPortal(
        <div className="event-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeVisitorEvent(); }}>
          <section data-analytics-event={selectedVisitorEvent.id} data-analytics-placement={visitorEventPlacement} className="event-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="visitor-event-title" tabIndex={-1}>
            <div className="event-detail-topbar">
              <button className="event-detail-back" type="button" autoFocus onClick={closeVisitorEvent}><span aria-hidden="true"><T>{"←"}</T></span><T>{" Terug naar de agenda"}</T></button>
              <A><button className="event-detail-close" type="button" aria-label="Sluiten" onClick={closeVisitorEvent}><T>{"×"}</T></button></A>
            </div>
            <EventImage className="event-detail-image" src={selectedVisitorEvent.image_url} loading="eager" />
            <div className="event-detail-content">
              <p className="event-detail-kicker"><T>{categories.find((category) => category.id === selectedVisitorEvent.category_id)?.name ?? "Activiteit in de streek"}</T></p>
              <h2 id="visitor-event-title"><T>{selectedVisitorEvent.title}</T></h2>
              <p className="event-detail-date"><T>{formatDate(selectedVisitorEvent.start_at)}</T><T>{selectedVisitorEvent.end_at ? ` – ${formatDate(selectedVisitorEvent.end_at)}` : ""}</T></p>
              <p className="event-detail-place"><T>{[selectedVisitorEvent.venue_name, selectedVisitorEvent.address, selectedVisitorEvent.postcode, selectedVisitorEvent.city].filter(Boolean).join(", ") || selectedVisitorEvent.city || "Lot-et-Garonne"}</T></p>
              <T>{(selectedVisitorEvent.short_description || selectedVisitorEvent.description) && <p className="event-detail-description"><T>{selectedVisitorEvent.description || selectedVisitorEvent.short_description}</T></p>}</T>
              <T>{selectedVisitorEvent.is_free ? <p className="event-detail-price"><T>{"Gratis"}</T></p> : selectedVisitorEvent.price_from != null ? <p className="event-detail-price"><T>{"Vanaf €"}</T><T>{Number(selectedVisitorEvent.price_from).toFixed(2)}</T><T>{selectedVisitorEvent.price_to != null ? ` tot €${Number(selectedVisitorEvent.price_to).toFixed(2)}` : ""}</T></p> : null}</T>
              <div className="event-detail-links">
                <T>{publicEventUrl(selectedVisitorEvent.booking_url) && <a className="event-detail-primary" data-analytics-channel="booking" href={publicEventUrl(selectedVisitorEvent.booking_url)!} target="_blank" rel="noopener noreferrer"><T>{"Reserveren "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
                <T>{publicEventUrl(selectedVisitorEvent.website_url) && <a data-analytics-channel="website" href={publicEventUrl(selectedVisitorEvent.website_url)!} target="_blank" rel="noopener noreferrer"><T>{"Website organisator "}</T><span aria-hidden="true"><T>{"↗"}</T></span></a>}</T>
              </div>
              <p className="event-detail-note"><T>{"Externe pagina’s openen in een nieuw tabblad. Je kunt hierna direct terug naar de agenda."}</T></p>
              {!hasActiveAdvertising(selectedVisitorEvent)&&<p><a className="more-customers-button" href={'/adverteren?eventId='+selectedVisitorEvent.id}><T>Meer klanten bereiken</T><span aria-hidden="true"> →</span></a></p>}
              <p className="event-management-link"><a href={'/mijn-vermelding?'+new URLSearchParams({eventId:selectedVisitorEvent.id,title:selectedVisitorEvent.title})}><T>Mijn vermelding: beheren of een correctie doorgeven →</T></a></p><button className="event-detail-back event-detail-back-bottom" type="button" onClick={closeVisitorEvent}><span aria-hidden="true"><T>{"←"}</T></span><T>{" Terug naar de agenda"}</T></button>
            </div>
          </section>
        </div>,
        document.body,
      )}</T>
    </main>
  );
}
