"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./amsterdam-demo.module.css";
import { AMSTERDAM_DEMO_PLACES, distanceKm } from "./places";

type EventItem = {
  id: string; title: string; description: string; start: string; end: string; url: string;
  distanceKm: number; category: string; source: string;
};
type DirectoryItem = {
  id: string; type: string; name: string; address: string; municipality: string; phone?: string;
  website?: string; openingHours?: string; distanceKm: number; sourceUrl: string;
};
type ApiResult<T> = { error?: string; events?: T[]; services?: T[]; updatedAt?: string; sourceStatus?: string; emergency?: {number:string;label:string;sourceUrl:string} };

const eventCategories = ["Alle categorieën", "Markten & braderieën", "Concerten & muziek", "Theater & podium", "Festivals & evenementen", "Workshops & cursussen", "Kinderen & familie", "Sport & bewegen", "Natuur & buiten", "Kunst & tentoonstellingen", "Eten & drinken", "Film & cinema", "Overig"];
const directoryCategories = ["Alle voorzieningen", "Gemeentehuis", "Huisarts & medisch centrum", "Ziekenhuis", "Apotheek", "Bibliotheek", "Kerk", "Tandarts", "Fysiotherapie", "Psychologische hulp", "Toeristeninformatie", "Politie", "Brandweer"];
const imageUrl = "https://commons.wikimedia.org/wiki/Special:FilePath/Amsterdam_Canal_(49000703426).jpg?width=2400";

function formatDate(value: string): string {
  if (!value) return "Datum niet opgegeven";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: value.length > 10 ? "short" : undefined, timeZone: "Europe/Amsterdam" }).format(date);
}

export default function AmsterdamDemo() {
  const [tab, setTab] = useState<"events" | "directory">("events");
  const [city, setCity] = useState("Amsterdam");
  const [radius, setRadius] = useState(5);
  const [eventCategory, setEventCategory] = useState("Alle categorieën");
  const [directoryCategory, setDirectoryCategory] = useState("Alle voorzieningen");
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [services, setServices] = useState<DirectoryItem[]>([]);
  const [eventStatus, setEventStatus] = useState("loading");
  const [directoryStatus, setDirectoryStatus] = useState("idle");
  const [eventError, setEventError] = useState("");
  const [directoryError, setDirectoryError] = useState("");
  const [emergency, setEmergency] = useState<ApiResult<DirectoryItem>["emergency"]>();
  const selectedPlace = useMemo(() => AMSTERDAM_DEMO_PLACES.find((place) => place.name === city) ?? AMSTERDAM_DEMO_PLACES[0], [city]);
  const nearbyPlaces = useMemo(() => AMSTERDAM_DEMO_PLACES
    .map((place) => ({ ...place, distanceKm: Math.round(distanceKm(selectedPlace, place) * 10) / 10 }))
    .filter((place) => place.distanceKm <= radius)
    .sort((a, b) => a.distanceKm - b.distanceKm), [selectedPlace, radius]);

  const loadEvents = useCallback(async () => {
    setEventStatus("loading"); setEventError("");
    const params = new URLSearchParams({ city, radius: String(radius), category: eventCategory, q: search });
    try {
      const response = await fetch(`/api/amsterdam-demo/events?${params}`, { cache: "no-store" });
      const result = await response.json() as ApiResult<EventItem>;
      if (!response.ok) throw new Error(result.error ?? "De agenda kon niet worden geladen.");
      setEvents(result.events ?? []); setEventStatus(result.sourceStatus ?? "live");
    } catch (error) {
      setEvents([]); setEventStatus("unavailable"); setEventError(error instanceof Error ? error.message : "De agenda kon niet worden geladen.");
    }
  }, [city, radius, eventCategory, search]);

  const loadDirectory = useCallback(async () => {
    setDirectoryStatus("loading"); setDirectoryError("");
    const params = new URLSearchParams({ city, radius: String(radius), category: directoryCategory });
    try {
      const response = await fetch(`/api/amsterdam-demo/directory?${params}`, { cache: "no-store" });
      const result = await response.json() as ApiResult<DirectoryItem>;
      if (!response.ok) throw new Error(result.error ?? "De gemeentegids kon niet worden geladen.");
      setServices(result.services ?? []); setEmergency(result.emergency); setDirectoryStatus(result.sourceStatus ?? "live");
    } catch (error) {
      setServices([]); setDirectoryStatus("unavailable"); setDirectoryError(error instanceof Error ? error.message : "De gemeentegids kon niet worden geladen.");
    }
  }, [city, radius, directoryCategory]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const changeTab = (value: "events" | "directory") => {
    setTab(value);
    if (value === "directory" && directoryStatus === "idle") void loadDirectory();
  };
  const placesInRadius = nearbyPlaces.map((place) => place.name).join(" · ");

  return (
    <div className={styles.page}>
      <div className={styles.topline}>
        <a href="/" className={styles.brand}><span className={styles.brandMark}>CdD</span><span>Côte de Duras <small>Amsterdam-demonstratie</small></span></a>
        <a href="/" className={styles.returnLink}>← Terug naar de Côte de Duras-preview</a>
      </div>

      <header className={styles.hero} style={{ backgroundImage: `linear-gradient(90deg, rgba(13,45,42,.77), rgba(13,45,42,.25)), url("${imageUrl}")` }}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>AFZONDERLIJKE, KOSTELOZE PREVIEW</span>
          <h1>Amsterdam & omgeving</h1>
          <p>Evenementen en praktische informatie, doorzoekbaar op plaats, categorie en afstand.</p>
          <span className={styles.heroScope}>Demogebied · maximaal 50 kilometer rond de gekozen plaats</span>
        </div>
        <a className={styles.photoCredit} href="https://commons.wikimedia.org/wiki/File:Amsterdam_Canal_(49000703426).jpg" target="_blank" rel="noreferrer">Foto: André Silva · CC0</a>
      </header>

      <section className={styles.searchPanel} aria-label="Zoek in Amsterdam en omgeving">
        <div className={styles.filters}>
          <label>Zoekplaats
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              {AMSTERDAM_DEMO_PLACES.map((place) => <option key={place.name} value={place.name}>{place.name}</option>)}
            </select>
          </label>
          <label>Zoek binnen
            <select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>
              {[5, 10, 25, 50].map((distance) => <option key={distance} value={distance}>{distance} kilometer</option>)}
            </select>
          </label>
          {tab === "events" ? <>
            <label>Soort activiteit
              <select value={eventCategory} onChange={(event) => setEventCategory(event.target.value)}>
                {eventCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className={styles.searchField}>Zoek op activiteit
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Bijvoorbeeld markt of concert" />
            </label>
          </> : <label className={styles.searchField}>Welke informatie zoek je?
            <select value={directoryCategory} onChange={(event) => setDirectoryCategory(event.target.value)}>
              {directoryCategories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>}
          <button className={styles.searchButton} type="button" onClick={() => tab === "events" ? void loadEvents() : void loadDirectory()}>{tab === "events" ? "Zoek activiteiten" : "Toon informatie"} →</button>
        </div>
        <p className={styles.nearbyPlaces}><strong>Plaatsen in dit zoekgebied:</strong> {placesInRadius || "geen plaats in deze straal"}</p>
      </section>

      <nav className={styles.tabs} aria-label="Demofuncties">
        <button type="button" aria-pressed={tab === "events"} onClick={() => changeTab("events")}>Agenda</button>
        <button type="button" aria-pressed={tab === "directory"} onClick={() => changeTab("directory")}>Gemeente informatie</button>
        <span className={styles.demoNotice}>Demo-informatie uit openbare bronnen</span>
      </nav>

      {tab === "events" ? <main className={styles.results}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>AGENDA · {city.toLocaleUpperCase("nl")}</span><h2>Wat is er te doen?</h2></div>
          <span className={styles.count}>{eventStatus === "loading" ? "Laden…" : `${events.length} gevonden`}</span>
        </div>
        {eventError && <p className={styles.error} role="alert">{eventError}</p>}
        {eventStatus === "loading" && <p className={styles.empty}>Openbare agenda wordt opgehaald…</p>}
        {eventStatus !== "loading" && !eventError && events.length === 0 && <div className={styles.empty}><strong>Geen passende activiteiten in deze feed.</strong><p>De officiële Amsterdam-feed bevat vergunnings- en gemeentelijke activiteiten. De I amsterdam-agenda heeft een bredere culturele selectie en kan ook evenementen uit de regio tonen.</p><a href="https://www.iamsterdam.com/en/whats-on/calendar" target="_blank" rel="noreferrer">Open I amsterdam agenda ↗</a></div>}
        <div className={styles.eventGrid}>
          {events.map((event) => <article className={styles.eventCard} key={event.id}>
            <div className={styles.eventTop}><span>{event.category}</span><span>{event.distanceKm} km</span></div>
            <h3>{event.title}</h3>
            <p className={styles.date}>{formatDate(event.start)}{event.end && event.end !== event.start ? ` – ${formatDate(event.end)}` : ""}</p>
            {event.description && <p className={styles.description}>{event.description}</p>}
            <a className={styles.cardLink} href={event.url} target="_blank" rel="noreferrer">Bekijk de bronpagina ↗</a>
            <small>Bron: {event.source}</small>
          </article>)}
        </div>
        <section className={styles.sources}>
          <div><span className={styles.kicker}>BRONNEN EN REIKWIJDTE</span><h3>Open agenda's in de regio</h3><p>De gemeentelijke open data wordt live opgehaald. De overige agenda's zijn directe links: deze demopreview leest hun vermeldingen niet automatisch over.</p></div>
          <a href="https://api.data.amsterdam.nl/v1/docs/datasets/evenementen@v1.html" target="_blank" rel="noreferrer"><strong>Gemeente Amsterdam · Datapunt</strong><small>Open API · gemeentelijke evenementendata</small></a>
          <a href="https://www.iamsterdam.com/en/whats-on/calendar" target="_blank" rel="noreferrer"><strong>I amsterdam · culturele agenda</strong><small>Brede culturele agenda, met filter voor Amsterdam Area</small></a>
          <a href="https://activiteiten.amsterdam.nl/evenementenbureau/" target="_blank" rel="noreferrer"><strong>Amsterdam · evenementenkalender</strong><small>Vergunningsplichtige grote evenementen en openbare activiteiten</small></a>
          <a href="https://uithaarlem.nl/events/" target="_blank" rel="noreferrer"><strong>UITagenda Haarlem</strong><small>Lokale agenda rond Haarlem</small></a>
          <a href="https://www.visitalmere.com/en/calendar/overview" target="_blank" rel="noreferrer"><strong>Visit Almere · kalender</strong><small>Evenementenagenda Almere</small></a>
          <a href="https://visithaarlemmermeer.nl/UITagenda" target="_blank" rel="noreferrer"><strong>Visit Haarlemmermeer · UITagenda</strong><small>Lokale activiteiten en evenementen</small></a>
        </section>
      </main> : <main className={styles.results}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>GEMEENTEGIDS · {city.toLocaleUpperCase("nl")}</span><h2>Praktische informatie dichtbij</h2></div>
          <span className={styles.count}>{directoryStatus === "loading" ? "Laden…" : `${services.length} gevonden`}</span>
        </div>
        <p className={styles.directoryIntro}>Contactgegevens en openingstijden worden getoond als ze door OpenStreetMap zijn vastgelegd. De kaartgegevens zijn niet in iedere plaats even volledig; controleer belangrijke informatie bij de organisatie zelf.</p>
        {directoryError && <p className={styles.error} role="alert">{directoryError}</p>}
        {directoryStatus === "loading" && <p className={styles.empty}>Voorzieningen in de omgeving worden opgehaald…</p>}
        {emergency && <div className={styles.emergency}><strong>Direct hulp nodig?</strong><span><b>{emergency.number}</b> · {emergency.label}</span><a href={emergency.sourceUrl} target="_blank" rel="noreferrer">Overheidinformatie ↗</a></div>}
        {directoryStatus !== "loading" && !directoryError && services.length === 0 && <div className={styles.empty}><strong>Geen gemarkeerde voorzieningen gevonden voor deze selectie.</strong><p>Een lege lijst betekent niet dat de voorziening ontbreekt. Bekijk de kaartbron of de officiële gemeentelijke website.</p><a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${directoryCategory} ${city}`)}`} target="_blank" rel="noreferrer">Zoek deze dienst op OpenStreetMap ↗</a></div>}
        <div className={styles.directoryGrid}>
          {services.map((service) => <article className={styles.directoryCard} key={service.id}>
            <div className={styles.eventTop}><span>{service.type}</span><span>{service.distanceKm} km</span></div>
            <h3>{service.name}</h3>
            <p>{service.address || service.municipality || "Adres niet vastgelegd in de bron"}</p>
            {service.phone && <a href={`tel:${service.phone.replace(/[^+\d]/g, "")}`}>{service.phone}</a>}
            {service.openingHours && <p><strong>Openingstijden:</strong> {service.openingHours}</p>}
            <div className={styles.cardActions}><a href={service.sourceUrl} target="_blank" rel="noreferrer">Open kaartgegevens ↗</a>{service.website && <a href={service.website.startsWith("http") ? service.website : `https://${service.website}`} target="_blank" rel="noreferrer">Website ↗</a>}</div>
          </article>)}
        </div>
        <section className={styles.sources}>
          <div><span className={styles.kicker}>BRONNEN EN REIKWIJDTE</span><h3>Gids en openbare gegevens</h3><p>De gemeentegids gebruikt kaartgegevens die door bijdragers zijn vastgelegd. Het is geen officiële of gegarandeerd volledige gemeentelijke lijst.</p></div>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer"><strong>OpenStreetMap</strong><small>Kaart- en plaatsgegevens onder ODbL</small></a>
          <a href="https://www.amsterdam.nl/" target="_blank" rel="noreferrer"><strong>Gemeente Amsterdam</strong><small>Officiële gemeentelijke informatie</small></a>
          <a href="https://www.rijksoverheid.nl/onderwerpen/alarmnummer-112" target="_blank" rel="noreferrer"><strong>Alarmnummer 112</strong><small>Officiële overheidsinformatie</small></a>
        </section>
      </main>}

      <footer className={styles.footer}>
        <div><strong>CÔTE DE DURAS</strong><span>Amsterdam-demonstratie · alleen Preview</span></div>
        <p>Deze proef leest openbare bronnen en gebruikt geen productie- of gedeelde database.</p>
        <a href="https://commons.wikimedia.org/wiki/File:Amsterdam_Canal_(49000703426).jpg" target="_blank" rel="noreferrer">Amsterdamfoto door André Silva · CC0 ↗</a>
      </footer>
    </div>
  );
}
