import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  createRegionalOfficialAgendasSource,
  fetchRegionalOfficialEventsWithReport,
} from "../../../../lib/import-sources/regional-official-agendas";
import { inferEventCategorySlug, runExternalEventImport } from "../../../../lib/import-sources";

export const runtime = "nodejs";
export const revalidate = 0;
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET ontbreekt in de Vercel-instellingen." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "De serverinstelling voor Supabase ontbreekt." }, { status: 503 });

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data: categories, error: categoryError } = await supabase.from("categories").select("id,slug").eq("active", true);
    if (categoryError) throw new Error(`Categorieën laden mislukt: ${categoryError.message}`);

    const fetched = await fetchRegionalOfficialEventsWithReport();
    const source = createRegionalOfficialAgendasSource(async (event, categoryId) => {
      const { data, error } = await supabase.rpc("sync_regional_official_pending_event", {
        p_event: event,
        p_category_id: categoryId,
      });
      if (error) throw new Error(`Opslaan van “${event.title}” is mislukt: ${error.message}`);
      return data === "inserted" || data === "enriched" ? data : "skipped";
    }, inferEventCategorySlug);
    const summary = await runExternalEventImport({
      ...source,
      fetchEvents: async () => fetched.events,
    }, categories ?? []);

    return NextResponse.json({ ok: true, ...summary, sources: fetched.sources });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
