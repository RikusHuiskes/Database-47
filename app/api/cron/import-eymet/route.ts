import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { inferEventCategorySlug, runExternalEventImport } from "../../../../lib/import-sources";
import { EYMET_SOURCE_NAME, fetchEymetEvents } from "../../../../lib/import-sources/eymet";

export const runtime = "nodejs";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET ontbreekt in de Vercel-instellingen." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase-configuratie ontbreekt." }, { status: 503 });

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data: categories, error: categoriesError } = await supabase.from("categories").select("id,slug").eq("active", true);
    if (categoriesError) throw new Error(`Categorieën laden mislukt: ${categoriesError.message}`);
    const summary = await runExternalEventImport({
      id: "eymet-eden",
      name: EYMET_SOURCE_NAME,
      fetchEvents: fetchEymetEvents,
      categorySlugFor: inferEventCategorySlug,
      persistPendingEvent: async (event, categoryId) => {
        const { data, error } = await supabase.rpc("sync_eymet_pending_event", { p_event: event, p_category_id: categoryId });
        if (error) throw new Error(`Opslaan van “${event.title}” mislukt: ${error.message}`);
        return data === "inserted" || data === "enriched" ? data : "skipped";
      },
    }, categories ?? []);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
