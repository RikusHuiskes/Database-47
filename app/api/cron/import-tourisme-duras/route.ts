import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { ImportedEvent } from "../../../../lib/tourisme-duras";
import { fetchTourismeDurasEvents } from "../../../../lib/tourisme-duras-source";

export const runtime = "nodejs";
export const revalidate = 0;
export const maxDuration = 60;

type Category = { id: string; slug: string };

function categorySlugFor(event: ImportedEvent): string | null {
  const title = `${event.title} ${event.description ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const kind = (event.source_category ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/randonnee|balade|vtt|marche sportive|circuit|nature/.test(title)) return "nature-randonnee";
  if (/marche|brocante|vide-grenier|foire/.test(title) || /manifestation commerciale/.test(kind)) return "marches-brocantes";
  if (/concert|musique|chorale/.test(title) || /concert|musique/.test(kind)) return "concerts-musique";
  if (/theatre|spectacle|representation/.test(title) || /theatre|spectacle/.test(kind)) return "theatre-spectacles";
  if (/atelier|stage|cours|initiation/.test(title)) return "ateliers-cours";
  if (/exposition|photophore|peinture|sculpture|photograph/.test(title)) return "art-expositions";
  if (/enfant|famille|jeunesse|kid/.test(title)) return "enfants-famille";
  if (/restaurant|repas|diner|dejeuner|choucroute|tartiflette|garbure|loto gourmand/.test(title)) return "restaurants-gastronomie";
  if (/animation et fete locale|fetes et manifestations/.test(kind)) return "festivals-fetes";
  if (/sports et loisirs|sport/.test(kind)) return "sport";
  if (/culturelle|culture|musee|patrimoine/.test(kind)) return "culture-musees";
  return null;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET ontbreekt in de Vercel-instellingen." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return NextResponse.json({ error: "Supabase-configuratie ontbreekt." }, { status: 503 });

  try {
    const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: categoryRows, error: categoryError } = await supabase.from("categories").select("id,slug").eq("active", true);
    if (categoryError) throw new Error(`Categorieën laden mislukt: ${categoryError.message}`);
    const categories = (categoryRows ?? []) as Category[];
    const events = await fetchTourismeDurasEvents();

    let inserted = 0;
    let enriched = 0;
    let skipped = 0;
    let skippedWithoutCategory = 0;
    for (const event of events) {
      const slug = categorySlugFor(event);
      const categoryId = categories.find((category) => category.slug === slug)?.id;
      if (!categoryId) {
        skippedWithoutCategory += 1;
        continue;
      }

      const { data, error } = await supabase.rpc("sync_tourisme_duras_pending_event", {
        p_event: event,
        p_category_id: categoryId,
      });
      if (error) throw new Error(`Opslaan van “${event.title}” mislukt: ${error.message}`);
      if (data === "inserted") inserted += 1;
      else if (data === "enriched") enriched += 1;
      else skipped += 1;
    }

    return NextResponse.json({ ok: true, source: "Tourisme Duras", checked: events.length, inserted, enriched, skipped, skippedWithoutCategory });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
