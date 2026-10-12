
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Category = {
  id?: string | number;
  name?: string;
  title?: string;
  slug?: string;
};

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState("Verbinden met Supabase...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !key) {
        setStatus(
          "Instellingen ontbreken. Controleer de Supabase-variabelen in Vercel."
        );
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient(url, key);

        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .limit(50);

        if (error) {
          setStatus("Databasefout: " + error.message);
          return;
        }

        setCategories((data ?? []) as Category[]);
        setStatus(
          `Verbinding geslaagd. ${data?.length ?? 0} categorieën gevonden.`
        );
      } catch {
        setStatus("Verbinding mislukt. Controleer de instellingen.");
      } finally {
        setLoading(false);
      }
    }

    loadCategories();
  }, []);

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 900,
        margin: "0 auto",
        fontFamily: "Arial, sans-serif",
        color: "#172033",
      }}
    >
      <h1>DATABASE 47</h1>
      <p>Regionale activiteitenagenda — Lot-et-Garonne</p>
      <hr />

      <h2>Admin Dashboard</h2>

      <p>Activiteiten: 0</p>
      <p>Te controleren: 0</p>
      <p>Organisaties: 0</p>
      <p>Promoties: 0</p>

      <hr />
      <h2>Supabase-verbinding</h2>
      <p>{loading ? "Bezig met verbinden..." : status}</p>

      <h3>Categorieën uit de database</h3>

      {!loading && categories.length === 0 && (
        <p>Er zijn geen categorieën getoond.</p>
      )}

      <ul>
        {categories.map((category, index) => (
          <li key={category.id ?? index}>
            {category.name ??
              category.title ??
              category.slug ??
              `Categorie ${index + 1}`}
          </li>
        ))}
      </ul>
    </main>
  );
}

