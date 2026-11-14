"use client";

import EventImage from './EventImage';
import { useEffect, useState } from "react";
import { T, useLanguage } from "../i18n/Language";

type PaidListing = {
  id: string;
  kind: "event" | "municipal";
  title: string;
  start_at: string | null;
  end_at: string | null;
  city: string;
  address: string | null;
  venue_name: string | null;
  description: string;
  image_url: string | null;
  href: string;
  placements: string[];
};

const placementNames: Record<string, string> = {
  homepage: "Homepagepartner",
  category: "Categoriepartner",
  highlight: "Uitgelichte vermelding",
};

function dateLabel(start: string | null, end: string | null, locale: string) {
  if (!start) return "";
  const startDate = new Date(start);
  if (!Number.isFinite(startDate.getTime())) return "";
  const first = startDate.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  if (!end) return first;
  const endDate = new Date(end);
  if (!Number.isFinite(endDate.getTime())) return first;
  const second = endDate.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  return first === second ? first : `${first} – ${second}`;
}

export default function PaidListingsCarousel() {
  const { locale, t } = useLanguage();
  const [listings, setListings] = useState<PaidListing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/paid-listings-carousel", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : { listings: [] })
      .then((payload: { listings?: PaidListing[] }) => {
        if (!controller.signal.aborted) setListings(Array.isArray(payload.listings) ? payload.listings : []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setListings([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (interacting || manualPause || reducedMotion || listings.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % listings.length), 7000);
    return () => window.clearInterval(timer);
  }, [listings.length, interacting, manualPause, reducedMotion]);

  if (loaded && listings.length === 0) return null;
  const current = listings.length ? listings[index % listings.length] : null;
  const date = current ? dateLabel(current.start_at, current.end_at, locale) : "";
  const location = current ? [current.venue_name, current.address, current.city].filter(Boolean).join(", ") : "";
  const previous = () => setIndex((value) => (value - 1 + listings.length) % listings.length);
  const next = () => setIndex((value) => (value + 1) % listings.length);

  return (
    <section
      className="paid-listings-carousel"
      role="region"
      aria-label={t("Betaalde vermeldingen uit de streek")}
      aria-roledescription="carrousel"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false);
      }}
    >
      <div className="paid-listings-heading">
        <div>
          <p className="section-kicker"><T>{"Lokale partners · uitgelicht"}</T></p>
          <h2><T>{"Ontdek wie de streek bijzonder maakt"}</T></h2>
          <p><T>{"Lokale ondernemers en activiteiten, zichtbaar in de agenda en gemeentegids."}</T></p>
        </div>
        {current && listings.length > 1 && (
          <div className="paid-listings-controls" aria-label="Carrouselbediening">
            <button type="button" onClick={previous} aria-label={t("Vorige advertentie")}>←</button>
            <span aria-live="off">{index + 1} / {listings.length}</span>
            {!reducedMotion && <button type="button" onClick={() => setManualPause((value) => !value)} aria-label={t(manualPause ? "Automatisch wisselen hervatten" : "Automatisch wisselen pauzeren")}>{manualPause ? "▶" : "Ⅱ"}</button>}
            <button type="button" onClick={next} aria-label={t("Volgende advertentie")}>→</button>
          </div>
        )}
      </div>
      {!loaded || !current ? (
        <div className="paid-listing-card paid-listing-loading" aria-live="polite"><T>{"Uitgelichte vermeldingen laden…"}</T></div>
      ) : (
        <article className="paid-listing-card" key={current.id} role="group" aria-label={`${index + 1} van ${listings.length}`} aria-roledescription="dia">
          <div className="paid-listing-media">
            <EventImage src={current.image_url} />
          </div>
          <div className="paid-listing-content">
            <div className="paid-listing-labels">
              <span className="paid-listing-source"><T>{current.kind === "municipal" ? "Gemeentegids" : "Evenementenkalender"}</T></span>
              {current.placements.map((placement) => <span className="paid-listing-placement" key={placement}><T>{placementNames[placement] ?? "Betaalde vermelding"}</T></span>)}
            </div>
            <h3><T>{current.title}</T></h3>
            {date && <p className="paid-listing-date">{date}</p>}
            {location && <p className="paid-listing-location">⌖ {location}</p>}
            {current.description && <p className="paid-listing-description"><T>{current.description}</T></p>}
            <a className="paid-listing-link" href={current.href} target={current.href.startsWith("http") ? "_blank" : undefined} rel={current.href.startsWith("http") ? "noreferrer" : undefined}>
              <T>{current.href === "#agenda" ? "Bekijk de agenda" : "Ontdek deze vermelding"}</T><span aria-hidden="true">→</span>
            </a>
          </div>
        </article>
      )}
    </section>
  );
}
