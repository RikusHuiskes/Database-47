
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type RecordRow = {
  id?: string | number;
  title?: string;
  name?: string;
  description?: string;
  start_date?: string;
  start_time?: string;
  status?: string;
  [key: string]: unknown;
};

export default function Home() {
  const [categories, setCategories] = useState<RecordRow[]>([]);
  const [events, setEvents] = useState<RecordRow[]>([]);
  const [categoryStatus, setCategoryStatus] = useState("Laden...");
  const [eventStatus, setEventStatus] = useState("Laden...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !key) {
        setCategoryStatus("Supabase-instellingen ontbreken.");
        setEventStatus("Controleer de variabelen in Vercel.");
        setLoading(false);
        return;
      }

      const supabase = createClient(url, key);

      const [categoryResult, eventResult] = await Promise.all([
        supabase.from("categories").select("*").limit(100),
        supabase.from("events").select("*").limit(50),
      ]);

      if (categoryResult.error) {
        setCategoryStatus("Fout: " + categoryResult.error.message);
      } else {
        setCategories(categoryResult.data ?? []);
        setCategoryStatus(
          `${categoryResult.data?.length ?? 0} categorieën geladen`
        );
      }

      if (eventResult.error) {
        setEventStatus("Fout: " + eventResult.error.message);
      } else {
        setEvents(eventResult.data ?? []);
        setEventStatus(
          `${eventResult.data?.length ?? 0} activiteiten gevonden`
        );
      }

      setLoading(false);
    }

    loadData().catch(() => {
      setCategoryStatus("Er ging iets mis bij het laden.");
      setEventStatus("Controleer de Supabase-verbinding.");
      setLoading(false);
    });
  }, []);

  return (
    <main style={{
      maxWidth: 1000,
      margin: "0 auto",
      padding: 24,
      fontFamily: "Arial, sans-serif",
      color: "#172033",
    }}>
      <h1>DATABASE 47</h1>
      <p>Regionale activiteitenagenda — Lot-et-Garonne</p>
      <hr />

      <h2>Admin Dashboard</h2>

      <p>Activiteiten geladen: {events.length}</p>
      <p>Categorieën: {categories.length}</p>

      <hr />
      <h2>Databaseverbinding</h2>
      <p>Categorieën: {categoryStatus}</p>
      <p>Activiteiten: {eventStatus}</p>

      <h2>Categorieën</h2>
      {categories.map((item, index) => (
        <p key={String(item.id ?? index)}>
          {String(item.name ?? item.title ?? item.slug ?? `Categorie ${index + 1}`)}
        </p>
      ))}

      <hr />
      <h2>Activiteiten</h2>

      {loading && <p>Activiteiten laden...</p>}

      {!loading && !events.length && !eventStatus.startsWith("Fout:") && (
        <p>Er staan nog geen activiteiten in de tabel.</p>
      )}

      {events.map((event, index) => (
        <article
          key={String(event.id ?? index)}
          style={{
            padding: 16,
            marginBottom: 12,
            border: "1px solid #d8dee8",
            borderRadius: 8,
          }}
        >
          <h3>
            {String(event.title ?? event.name ?? `Activiteit ${index + 1}`)}
          </h3>
          {event.start_date != null && (
            <p>Datum: {String(event.start_date)}</p>
          )}
          {event.description != null && (
            <p>{String(event.description)}</p>
          )}
          {event.status != null && (
            <p>Status: {String(event.status)}</p>
          )}
        </article>
      ))}
    </main>
  );
}
