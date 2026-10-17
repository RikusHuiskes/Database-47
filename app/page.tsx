
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
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
  start_at: string;
  end_at?: string | null;
  venue_name?: string | null;
  city?: string | null;
  status?: string;
  description?: string | null;
  short_description?: string | null;
  price_from?: number | null;
  price_to?: number | null;
  is_free?: boolean;
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

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      setError("CategorieÃ«n laden mislukt: " + categoryResult.error.message);
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
            category_name: category?.name ?? category?.slug ?? null,
          };
        }
      );

      setEvents(eventsWithCategories);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
    // De verbinding wordt bij het openen van de pagina geladen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    if (!supabase) {
      setError("Geen Supabase-verbinding.");
      return;
    }

    if (!title.trim() || !startAt) {
      setError("Vul minimaal de titel en startdatum in.");
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
      setError(
        "Opslaan mislukt: " +
          insertError.message +
          ". Controleer eventueel de INSERT-rechten in Supabase."
      );
      setSaving(false);
      return;
    }

  resetForm();
setShowForm(false);


    await loadData();
    setSaving(false);
  }

  function formatDate(value?: string | null) {
    if (!value) return "Datum onbekend";
    return new Date(value).toLocaleString("fr-FR", {
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
        <p>Regionale evenementenagenda â€” Lot-et-Garonne</p>
      </header>

      <hr />

      <h2>Beheerdersdashboard</h2>

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
          ["CategorieÃ«n", categories.length],
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
          ? `${categories.length} categorieÃ«n en ${events.length} evenementen geladen.`
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
      </div>

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
          <h2>Nieuw evenement invoeren</h2>
          <p style={{ marginTop: 0, color: "#64748b" }}>
            Velden met * zijn verplicht. Het evenement wordt eerst ter controle
            aangeboden.
          </p>

          <div>
            <label style={labelStyle}>Titel *</label>
            <input
              style={inputStyle}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijvoorbeeld: MarchÃ© nocturne"
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
            <label style={labelStyle}>Plaats</label>
            <input
              style={inputStyle}
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
                <label style={labelStyle}>Prijs tot (â‚¬)</label>
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
            <label style={labelStyle}>Bronlink</label>
            <input
              style={inputStyle}
              type="url"
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

      <h2>Evenementen</h2>

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
          {event.category_name && (
            <p><strong>Categorie:</strong> {event.category_name}</p>
          )}
          <p>{formatDate(event.start_at)}</p>
          {(event.venue_name || event.city) && (
            <p>{[event.venue_name, event.city].filter(Boolean).join(", ")}</p>
          )}
          {event.short_description && <p>{event.short_description}</p>}
          {event.description && <p>{event.description}</p>}
          <p>
            Status:{" "}
            {event.status === "pending"
              ? "In afwachting van controle"
              : event.status ?? "Onbekend"}
          </p>
           
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
        </article>

      ))}
    </main>
  );
}
