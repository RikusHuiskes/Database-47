
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { ImportedEvent } from "../lib/tourisme-duras";
import { inferEventCategorySlug } from "../lib/import-sources";
import type { LocalAreaTown } from "../lib/local-area";
type Category = {
  id: string;
  name?: string;
  slug?: string;
};

type EventCategoryRow = {
  event_id: string;
  category_id: string;
};

type EventRow = {
  id: string;
  title: string;
  slug: string;
  category_name?: string | null;
  category_id?: string | null;
  start_at: string;
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
};

type LocalAreaOption = LocalAreaTown & { latitude: number | null; longitude: number | null };
type NearbyEvent = EventRow & { distance_km: number; distance_is_approximate: boolean };

type ImportPreviewEvent = ImportedEvent & { category_id: string };

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
    return host;
  } catch {
    return "Bron niet vermeld";
  }
}

export default function Home() {
  const [localAreas, setLocalAreas] = useState<LocalAreaOption[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState("duras");
  const [visitorLocation, setVisitorLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [nearbyEvents, setNearbyEvents] = useState<NearbyEvent[]>([]);
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
  const [editDraft, setEditDraft] = useState<EventEditDraft | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewEvent[]>([]);
  const [importNotice, setImportNotice] = useState("");
  const [importSourceName, setImportSourceName] = useState("");
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [supabase] = useState(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) return null;
    return createClient(url, key);
  });

  useEffect(() => {
    let active = true;
    void fetch("/api/local-areas")
      .then(async (response) => {
        if (!response.ok) throw new Error("Plaatsen konden niet worden geladen.");
        return response.json();
      })
      .then((result) => {
        if (active) setLocalAreas((result.areas ?? []) as LocalAreaOption[]);
      })
      .catch((cause) => {
        if (active) setNearbyError(cause instanceof Error ? cause.message : "Plaatsen konden niet worden geladen.");
      });
    return () => { active = false; };
  }, []);

  const selectedArea = localAreas.find((area) => area.id === selectedAreaId);
  const searchLatitude = visitorLocation?.latitude ?? selectedArea?.latitude ?? null;
  const searchLongitude = visitorLocation?.longitude ?? selectedArea?.longitude ?? null;
  const searchLabel = visitorLocation ? "jouw locatie" : selectedArea?.name ?? "Duras";

  useEffect(() => {
    if (searchLatitude == null || searchLongitude == null) {
      if (localAreas.length > 0) {
        setNearbyLoading(false);
        setNearbyError("De gekozen plaats heeft geen bruikbare locatiegegevens.");
      }
      return;
    }

    let active = true;
    setNearbyLoading(true);
    setNearbyError("");
    const params = new URLSearchParams({
      lat: String(searchLatitude),
      lon: String(searchLongitude),
      radius: String(radiusKm),
    });
    void fetch(`/api/nearby-events?${params}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Evenementen konden niet worden geladen.");
        return result;
      })
      .then((result) => {
        if (!active) return;
        setNearbyEvents((result.events ?? []) as NearbyEvent[]);
        setLocationlessCount(Number(result.locationless_count ?? 0));
      })
      .catch((cause) => {
        if (active) setNearbyError(cause instanceof Error ? cause.message : "Evenementen konden niet worden geladen.");
      })
      .finally(() => { if (active) setNearbyLoading(false); });
    return () => { active = false; };
  }, [localAreas.length, searchLatitude, searchLongitude, radiusKm]);

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
  }

  async function loadData() {
    if (!supabase) {
      setError("Supabase-instellingen ontbreken. Controleer Vercel.");
      setLoading(false);
      return;
    }

    setError("");

    const [categoryResult, eventResult, eventCategoryResult] =
      await Promise.all([
        supabase.from("categories").select("*").order("name").limit(100),
        supabase
          .from("events")
          .select("*")
          .order("start_at", { ascending: true })
          .limit(100),
        supabase.from("event_categories").select("event_id, category_id"),
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
    } else if (eventCategoryResult.error) {
      setError((previous) =>
        previous
          ? previous + " | Categoriekoppelingen laden mislukt: " + eventCategoryResult.error.message
          : "Categoriekoppelingen laden mislukt: " + eventCategoryResult.error.message
      );
      setEvents((eventResult.data ?? []) as EventRow[]);
    } else {
      const eventCategoryRows =
        (eventCategoryResult.data ?? []) as EventCategoryRow[];
      const categoryRows = (categoryResult.data ?? []) as Category[];

      const eventsWithCategories = ((eventResult.data ?? []) as EventRow[]).map(
        (event) => {
          const link = eventCategoryRows.find(
            (row) => row.event_id === event.id
          );
          const category = categoryRows.find(
            (row) => row.id === link?.category_id
          );

          return {
            ...event,
            category_id: link?.category_id ?? null,
            category_name: category?.name ?? category?.slug ?? null,
          };
        }
      );

      setEvents(eventsWithCategories);
    }

    setLoading(false);
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
      await loadData();
      if (confirmedAdmin && active) {
        const deletedCount = await removeExpiredEvents();
        if (deletedCount && deletedCount > 0) await loadData();
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
    await loadData();
    if (confirmedAdmin) {
      const deletedCount = await removeExpiredEvents();
      if (deletedCount && deletedCount > 0) await loadData();
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
      .select("id")
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

    await loadData();
    setMessage(
      status === "approved"
        ? `“${event.title}” is goedgekeurd.`
        : `“${event.title}” is afgewezen.`
    );
    setUpdatingEventId(null);
  }

  async function saveCategoryName(category: Category) {
    if (!supabase || !isAdmin) return;
    const name = (categoryNames[category.id] ?? category.name ?? "").trim();
    if (!name) {
      setError("Een categorienaam mag niet leeg zijn.");
      return;
    }
    setSavingCategoryId(category.id);
    setError("");
    const { error: saveError } = await supabase.rpc("update_category_name", {
      p_category_id: category.id,
      p_name: name,
    });
    setSavingCategoryId(null);
    if (saveError) {
      setError("Categorienaam opslaan mislukt: " + saveError.message);
      return;
    }
    setCategories((current) => current.map((item) => item.id === category.id ? { ...item, name } : item));
    setMessage(`Categorie “${name}” opgeslagen.`);
  }

  function beginEdit(event: EventRow) {
    setError("");
    setMessage("");
    setEditingEventId(event.id);
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

  async function saveEventEdits(
    e: React.FormEvent<HTMLFormElement>,
    event: EventRow
  ) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!supabase || !editDraft) {
      setError("Geen Supabase-verbinding.");
      return;
    }
    if (!editDraft.title.trim() || !editDraft.start_at) {
      setError("Vul minimaal de titel en startdatum in.");
      return;
    }

    setUpdatingEventId(event.id);
    const payload = {
      title: editDraft.title.trim(),
      slug: makeSlug(editDraft.title),
      short_description: editDraft.short_description.trim() || null,
      description: editDraft.description.trim() || null,
      start_at: new Date(editDraft.start_at).toISOString(),
      end_at: editDraft.end_at ? new Date(editDraft.end_at).toISOString() : null,
      venue_name: editDraft.venue_name.trim() || null,
      address: editDraft.address.trim() || null,
      postcode: editDraft.postcode.trim() || null,
      city: editDraft.city.trim() || null,
      price_from: editDraft.is_free || !editDraft.price_from ? null : Number(editDraft.price_from),
      price_to: editDraft.is_free || !editDraft.price_to ? null : Number(editDraft.price_to),
      is_free: editDraft.is_free,
      website_url: editDraft.website_url.trim() || null,
      booking_url: editDraft.booking_url.trim() || null,
      source_url: editDraft.source_url.trim() || null,
    };

    const { data, error: updateError } = await supabase
      .from("events")
      .update(payload)
      .eq("id", event.id)
      .select("id")
      .maybeSingle();

    if (updateError) {
      setError("Opslaan mislukt: " + updateError.message);
      setUpdatingEventId(null);
      return;
    }
    if (!data) {
      setError("Er is niets gewijzigd. Controleer of je als beheerder bent ingelogd.");
      setUpdatingEventId(null);
      return;
    }

    if (editDraft.category_id !== (event.category_id ?? "")) {
      const { error: categoryError } = await supabase.rpc("set_event_category", {
        p_event_id: event.id,
        p_category_id: editDraft.category_id || null,
      });
      if (categoryError) {
        setError(`Evenement is bijgewerkt, maar de categorie kon niet worden opgeslagen: ${categoryError.message}`);
        setUpdatingEventId(null);
        await loadData();
        return;
      }
    }

    setEditingEventId(null);
    setEditDraft(null);
    await loadData();
    setMessage(`“${payload.title}” is bijgewerkt.`);
    setUpdatingEventId(null);
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
    setCity("");
    setPriceFrom("");
    setPriceTo("");
    setIsFree(false);
    setWebsiteUrl("");
    setBookingUrl("");
    setSourceUrl("");
    setCategoryId("");
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

    if (!title.trim() || !startAt) {
      setSubmissionError("Vul minimaal de titel en startdatum in.");
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      slug: makeSlug(title),
      short_description: shortDescription.trim() || null,
      description: description.trim() || null,
      start_at: new Date(startAt).toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : null,
      venue_name: venueName.trim() || null,
      address: address.trim() || null,
      postcode: postcode.trim() || null,
      city: city.trim() || null,
      price_from: isFree || priceFrom === "" ? null : Number(priceFrom),
      price_to: isFree || priceTo === "" ? null : Number(priceTo),
      is_free: isFree,
      website_url: websiteUrl.trim() || null,
      booking_url: bookingUrl.trim() || null,
      source_url: sourceUrl.trim() || null,
      status: "pending",
      verified: false,
    };

    const { error: insertError } = await supabase.rpc("submit_pending_event", {
  p_event: payload,
  p_category_id: categoryId || null,
});

    if (insertError) {
      setSubmissionError("Je tip kon niet worden verstuurd. Probeer het later opnieuw.");
      setSaving(false);
      return;
    }

  resetForm();
setShowForm(false);


    await loadData();
    setSubmissionNotice(`Dank je voor je tip over “${payload.title}”. De beheerder controleert de gegevens voordat het evenement in de agenda verschijnt.`);
    setSaving(false);
  }

  async function previewEventSource(endpoint: string, sourceName: string) {
    if (!isAdmin) return;
    setError("");
    setMessage("");
    setImportNotice("");
    setImportLoading(true);
    setImportPreview([]);
    setImportSourceName(sourceName);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "De agenda kon niet worden ingelezen.");
      const preview = (result.events as ImportedEvent[]).map((event) => ({
        ...event,
        category_id: suggestedCategoryId(event, categories),
      }));
      setImportPreview(preview);
      setImportNotice(`${result.events.length} toekomstige of lopende activiteiten gevonden bij ${sourceName}. Controleer de bron en gegevens; nieuwe activiteiten worden pas na import in de wachtrij voor controle gezet.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import voorbereiden is mislukt.");
    } finally {
      setImportLoading(false);
    }
  }

  async function previewTourismeDuras() {
    await previewEventSource("/api/import-tourisme-duras", "Tourisme Duras");
  }

  async function importTourismeDuras() {
    if (!supabase || !isAdmin || importPreview.length === 0) return;
    setError("");
    setMessage("");
    setImporting(true);
    setImportNotice("");
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
      ...(existingResult.data ?? []).map((event) => `${event.title.trim().toLocaleLowerCase("fr-FR")}|${event.start_at.slice(0, 10)}`),
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

  function setImportCategory(sourceUrl: string, categoryId: string) {
    setImportPreview((current) => current.map((event) =>
      event.source_url === sourceUrl ? { ...event, category_id: categoryId } : event
    ));
  }

  function formatDate(value?: string | null) {
    if (!value) return "Datum onbekend";
    return new Date(value).toLocaleString("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: 24,
        fontFamily: "Arial, sans-serif",
        color: "#172033",
      }}
    >
      <header>
        <h1>DATABASE 47</h1>
        <p>Activiteiten dichtbij huis — Duras en omgeving</p>
      </header>

      <hr />

      <section aria-labelledby="nearby-heading" style={{ margin: "28px 0 42px", padding: 24, background: "white", border: "1px solid #d8dee8", borderRadius: 14 }}>
        <h2 id="nearby-heading" style={{ marginTop: 0, fontSize: 30 }}>Wat is er te doen bij jou in de buurt?</h2>
        <p style={{ color: "#475569", lineHeight: 1.6, maxWidth: 720 }}>
          Kies een plaats en hoe ver je wilt zoeken. Je kunt ook je huidige locatie gebruiken; die wordt alleen voor deze zoekopdracht gebruikt.
        </p>
        <p style={{ color: "#334155", lineHeight: 1.6, maxWidth: 760 }}>
          DATABASE 47 brengt activiteiten uit de dorpen en steden om je heen samen. We tonen alleen gecontroleerde evenementen en verwijzen waar mogelijk naar de organisator of oorspronkelijke bron.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", alignItems: "end", gap: 14, maxWidth: 780 }}>
          <label style={labelStyle}>
            Zoek rond
            <select style={inputStyle} value={selectedAreaId} onChange={(event) => selectArea(event.target.value)}>
              {localAreas.map((area) => (
                <option key={area.id} value={area.id} disabled={area.latitude == null || area.longitude == null}>
                  {area.name} ({area.postcode})
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Zoek binnen
            <select style={inputStyle} value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
              {[10, 25, 50].map((radius) => <option key={radius} value={radius}>{radius} kilometer</option>)}
            </select>
          </label>
          <button type="button" onClick={useCurrentLocation} style={{ padding: 12, border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: 15 }}>
            Gebruik mijn locatie
          </button>
        </div>
        <p role="status" aria-live="polite" style={{ color: "#475569", margin: "18px 0 12px" }}>
          {nearbyLoading ? "Evenementen in de buurt zoeken…" : `${nearbyEvents.length} aankomende ${nearbyEvents.length === 1 ? "activiteit" : "activiteiten"} binnen ${radiusKm} km van ${searchLabel}.`}
        </p>
        {visitorLocation && <p style={{ color: "#64748b", marginTop: -4, fontSize: 14 }}>Zoeken rond je huidige locatie.</p>}
        {nearbyError && <p role="alert" style={{ padding: 12, background: "#fff1f2", color: "#9f1239", borderRadius: 8 }}>{nearbyError}</p>}
        {!nearbyLoading && !nearbyError && nearbyEvents.length === 0 && <p>Geen aankomende activiteiten gevonden. Probeer een grotere straal of een andere plaats.</p>}
        {locationlessCount > 0 && <p style={{ color: "#64748b", fontSize: 14 }}>{locationlessCount} aankomende {locationlessCount === 1 ? "activiteit heeft" : "activiteiten hebben"} nog geen herkenbare plaats en kan daarom niet op afstand worden getoond.</p>}
        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          {nearbyEvents.map((event) => (
            <article key={event.id} style={{ display: "grid", gridTemplateColumns: event.image_url ? "minmax(120px, 220px) minmax(0, 1fr)" : "1fr", gap: 18, padding: 18, border: "1px solid #d8dee8", borderRadius: 12 }}>
              {safeHttpUrl(event.image_url) && <img src={safeHttpUrl(event.image_url)!} alt={event.title} loading="lazy" style={{ width: "100%", maxHeight: 190, height: "100%", minHeight: 120, objectFit: "cover", borderRadius: 8 }} />}
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: 21 }}>{event.title}</h3>
                <p style={{ margin: "6px 0", color: "#475569" }}>{formatDate(event.start_at)}{event.end_at ? ` – ${formatDate(event.end_at)}` : ""}</p>
                <p style={{ margin: "6px 0", color: "#475569" }}>{event.distance_is_approximate ? "Ongeveer " : ""}{event.distance_km} km · {[event.venue_name, event.address, event.postcode, event.city].filter(Boolean).join(", ") || event.city}</p>
                {(event.short_description || event.description) && <p style={{ lineHeight: 1.55 }}>{event.short_description || event.description}</p>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  {safeHttpUrl(event.website_url) && <a href={safeHttpUrl(event.website_url)!} target="_blank" rel="noreferrer">Website</a>}
                  {safeHttpUrl(event.booking_url) && <a href={safeHttpUrl(event.booking_url)!} target="_blank" rel="noreferrer">Reserveren</a>}
                  {safeHttpUrl(event.source_url) && <a href={safeHttpUrl(event.source_url)!} target="_blank" rel="noreferrer">Meer informatie</a>}
                </div>
                {event.source_url && <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13 }}>Bron: {sourceLabel(event.source_url)}</p>}
              </div>
            </article>
          ))}
        </div>
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid #e2e8f0" }}>
          <strong>Ken je een activiteit die hier ontbreekt?</strong>
          <p style={{ margin: "6px 0 12px", color: "#475569" }}>Tip ons. Een beheerder controleert de gegevens voordat de activiteit zichtbaar wordt.</p>
          <button type="button" onClick={() => { setShowForm((current) => !current); setError(""); setMessage(""); }} style={{ padding: "11px 16px", border: 0, borderRadius: 8, background: "#173f5f", color: "white", cursor: "pointer", fontSize: 15 }}>
            {showForm ? "Tipformulier sluiten" : "Een activiteit doorgeven"}
          </button>
        </div>
      </section>

      {showForm && (
        <form
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
          <h2>Geef een activiteit door</h2>
          <p style={{ marginTop: 0, color: "#64748b" }}>
            Je tip komt eerst bij de beheerder ter controle. Een link naar de organisator of informatiebron helpt ons de gegevens te verifiëren.
          </p>

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
            <label style={labelStyle}>Categorie</label>
            <select
              style={inputStyle}
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
            <label style={labelStyle}>Plaats *</label>
            <input
              style={inputStyle}
              required
              maxLength={120}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Bijvoorbeeld: Duras"
            />
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
            <label style={labelStyle}>Website</label>
            <input
              style={inputStyle}
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label style={labelStyle}>Reserveringslink</label>
            <input
              style={inputStyle}
              type="url"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label style={labelStyle}>Informatiebron *</label>
            <input
              style={inputStyle}
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

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
            {saving ? "Opslaan..." : "Evenement opslaan"}
          </button>
        </form>
      )}

      {submissionError && <p role="alert" style={{ padding: 12, background: "#fff1f2", color: "#9f1239", borderRadius: 8 }}>{submissionError}</p>}
      {submissionNotice && <p role="status" style={{ padding: 12, background: "#ecfdf5", color: "#065f46", borderRadius: 8 }}>{submissionNotice}</p>}

      <details style={{ margin: "28px 0", padding: 16, background: "#f8fafc", border: "1px solid #d8dee8", borderRadius: 10 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>Beheerdersdashboard</summary>
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
           events.filter(
  (event) =>
    event.status?.toLowerCase() === "pending" &&
    event.verified === false
).length,
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

      {isAdmin && (
        <details style={{ margin: "18px 0", padding: 16, background: "white", border: "1px solid #d8dee8", borderRadius: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Categorieën beheren</summary>
          <p style={{ color: "#64748b" }}>Pas alleen de zichtbare naam aan. De vaste categoriecode blijft gelijk, zodat importen en bestaande evenementkoppelingen blijven werken.</p>
          <div style={{ display: "grid", gap: 10 }}>
            {categories.map((category) => (
              <div key={category.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) auto", gap: 8, alignItems: "center" }}>
                <input
                  aria-label={`Naam van categorie ${category.name ?? category.slug ?? ""}`}
                  style={inputStyle}
                  value={categoryNames[category.id] ?? category.name ?? category.slug ?? ""}
                  onChange={(event) => setCategoryNames((current) => ({ ...current, [category.id]: event.target.value }))}
                  maxLength={80}
                />
                <button type="button" onClick={() => void saveCategoryName(category)} disabled={savingCategoryId === category.id}>
                  {savingCategoryId === category.id ? "Opslaan…" : "Opslaan"}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

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
          onClick={() => {
            setShowForm(!showForm);
            setError("");
            setMessage("");
          }}
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
          {showForm ? "Formulier sluiten" : "+ Nieuw evenement"}
        </button>

        <button
          type="button"
          onClick={() => void loadData()}
          style={{
            padding: "12px 18px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "white",
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          Vernieuwen
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => void previewTourismeDuras()}
            disabled={importLoading || importing}
            style={{
              padding: "12px 18px",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "white",
              cursor: importLoading || importing ? "wait" : "pointer",
              fontSize: 15,
            }}
          >
            {importLoading ? "Agenda ophalen..." : "Tourisme Duras importeren"}
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => void previewEventSource("/api/import-eymet", "Commune d’Eymet — agenda cultureel officieel")}
            disabled={importLoading || importing}
            style={{ padding: "12px 18px", border: "1px solid #cbd5e1", borderRadius: 8, background: "white", cursor: importLoading || importing ? "wait" : "pointer", fontSize: 15 }}
          >
            {importLoading ? "Agenda ophalen..." : "Eymet-agenda importeren"}
          </button>
        )}
      </div>

      {importNotice && (
        <section style={{ padding: 18, marginBottom: 24, background: "white", border: "1px solid #d8dee8", borderRadius: 10 }}>
          <p role="status">{importNotice}</p>
          <p style={{ color: "#64748b" }}>Bron: <strong>{importSourceName}</strong>. Waar beschikbaar worden adres, website, reserveringslink, telefoon en foto van de detailpagina opgehaald. Iedere activiteit toont hieronder de bronlink en blijft na import op Wacht op controle totdat jij haar goedkeurt. Je kunt de voorgestelde categorie vóór of na import wijzigen.</p>
          {categories.length === 0 && <p role="alert" style={{ color: "#9f1239" }}>Er zijn geen categorieën geladen. Importeer nog niet; de categorieën moeten eerst in deze database beschikbaar zijn.</p>}
          <ul style={{ maxHeight: 320, overflowY: "auto", paddingLeft: 22 }}>
            {importPreview.map((event) => (
              <li key={event.source_url} style={{ marginBottom: 8 }}>
                <strong>{event.title}</strong> — {formatDate(event.start_at)}{event.end_at ? ` t/m ${formatDate(event.end_at)}` : ""}
                <div>{[event.venue_name, event.address, event.postcode, event.city].filter(Boolean).join(", ") || event.city || "Adres niet op de bronpagina gevonden"}</div>
                {event.source_category && <div>Type bij bron: {event.source_category}</div>}
                <div>Bron: <strong>{sourceLabel(event.source_url)}</strong></div>
                {event.contact_phone && <div>Telefoon: {event.contact_phone}</div>}
                {event.website_url && <div>Website gevonden</div>}
                {event.booking_url && <div>Reserveringslink gevonden</div>}
                {event.image_url && <div>Foto gevonden</div>}
                <label style={{ display: "block", marginTop: 6 }}>
                  Categorie voor Database 47: {" "}
                  <select
                    value={event.category_id}
                    onChange={(e) => setImportCategory(event.source_url, e.target.value)}
                    disabled={categories.length === 0 || importing}
                    style={{ ...inputStyle, maxWidth: 340, padding: 7 }}
                  >
                    <option value="">Kies een categorie</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name ?? category.slug ?? category.id}</option>)}
                  </select>
                </label>
                <a href={event.source_url} target="_blank" rel="noreferrer">Bronpagina bekijken: {sourceLabel(event.source_url)}</a>
              </li>
            ))}
          </ul>
          {importPreview.length > 0 && (
            <button
              type="button"
              onClick={() => void importTourismeDuras()}
              disabled={importing || !isAdmin || categories.length === 0}
              style={{ padding: "12px 18px", border: 0, borderRadius: 8, background: importing ? "#94a3b8" : "#16734b", color: "white", cursor: importing ? "wait" : "pointer", fontSize: 15 }}
            >
              {importing ? "Importeren..." : "Wachtende imports aanvullen en nieuwe evenementen importeren"}
            </button>
          )}
        </section>
      )}

      <h2>Evenementen beheren</h2>

      {loading && <p>Gegevens laden...</p>}

      {!loading && events.length === 0 && (
        <p>Er zijn nog geen evenementen opgeslagen.</p>
      )}

      {events.map((event) => (
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
          {safeHttpUrl(event.image_url) && <img src={safeHttpUrl(event.image_url)!} alt={event.title} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 8, marginBottom: 12 }} />}
          {event.category_name && (
            <p><strong>Categorie:</strong> {event.category_name}</p>
          )}
          <p>{formatDate(event.start_at)}</p>
          {(event.venue_name || event.address || event.postcode || event.city) && (
            <p>{[event.venue_name, event.address, event.postcode, event.city].filter(Boolean).join(", ")}</p>
          )}
          {event.contact_phone && <p>Telefoon: <a href={`tel:${event.contact_phone.replace(/[^+\d]/g, "")}`}>{event.contact_phone}</a></p>}
          {safeHttpUrl(event.website_url) && <p><a href={safeHttpUrl(event.website_url)!} target="_blank" rel="noreferrer">Website</a></p>}
          {safeHttpUrl(event.booking_url) && <p><a href={safeHttpUrl(event.booking_url)!} target="_blank" rel="noreferrer">Reserveren</a></p>}
          {event.source_category && <p>Type bij bron: {event.source_category}</p>}
          {event.organizer_name && <p>Organisator: {event.organizer_name}</p>}
          {event.source_url && <p>Bron: {sourceLabel(event.source_url)}</p>}
          {safeHttpUrl(event.source_url) && <p><a href={safeHttpUrl(event.source_url)!} target="_blank" rel="noreferrer">Bronpagina</a></p>}
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

          {isAdmin && editingEventId !== event.id && (
            <button
              type="button"
              onClick={() => beginEdit(event)}
              style={{
                marginBottom: 12,
                padding: "10px 14px",
                border: "1px solid #cbd5e1",
                borderRadius: 7,
                background: "white",
                cursor: "pointer",
              }}
            >
              Bewerken
            </button>
          )}

          {isAdmin && event.status?.toLowerCase() === "pending" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                type="button"
                disabled={updatingEventId === event.id}
                onClick={() => void setEventStatus(event, "approved")}
                style={{
                  padding: "10px 14px",
                  border: 0,
                  borderRadius: 7,
                  background: updatingEventId === event.id ? "#94a3b8" : "#16734b",
                  color: "white",
                  cursor: updatingEventId === event.id ? "wait" : "pointer",
                }}
              >
                {updatingEventId === event.id ? "Bezig..." : "Goedkeuren"}
              </button>
              <button
                type="button"
                disabled={updatingEventId === event.id}
                onClick={() => void setEventStatus(event, "rejected")}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #fecaca",
                  borderRadius: 7,
                  background: "white",
                  color: "#b91c1c",
                  cursor: updatingEventId === event.id ? "wait" : "pointer",
                }}
              >
                Afwijzen
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
                >
                  <option value="">Geen categorie</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name ?? category.slug}</option>
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
                Begindatum en -tijd *
                <input
                  style={inputStyle}
                  type="datetime-local"
                  required
                  value={editDraft.start_at}
                  onChange={(e) => updateEditDraft("start_at", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Einddatum en -tijd
                <input
                  style={inputStyle}
                  type="datetime-local"
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
                  type="url"
                  value={editDraft.website_url}
                  onChange={(e) => updateEditDraft("website_url", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Reserveringslink
                <input
                  style={inputStyle}
                  type="url"
                  value={editDraft.booking_url}
                  onChange={(e) => updateEditDraft("booking_url", e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Bronlink
                <input
                  style={inputStyle}
                  type="url"
                  value={editDraft.source_url}
                  onChange={(e) => updateEditDraft("source_url", e.target.value)}
                />
              </label>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button
                  type="submit"
                  disabled={updatingEventId === event.id}
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
                  disabled={updatingEventId === event.id}
                  onClick={() => {
                    setEditingEventId(null);
                    setEditDraft(null);
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
      </>}
      </details>
    </main>
  );
}




