import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { inferEventCategorySlug, runExternalEventImport } from "../../../../lib/import-sources";
import { EYMET_SOURCE_NAME, fetchEymetEvents } from "../../../../lib/import-sources/eymet";
import { createServiceClient } from "../../../../lib/supabase-server";

export const runtime = "nodejs";
export const revalidate = 0;
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET ontbreekt in de Vercel-instellingen." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase-configuratie ontbreekt." }, { status: 503 });

  try {
    const supabase = createServiceClient();
    const { data: categories, error: categoriesError } = await supabase.from("categories").select("id,slug").eq("active", true);
    if (categoriesError) throw new Error(`Categorieën laden mislukt: ${categoriesError.message}`);
    const summary = await runExternalEventImport({
      id: "eymet-eden",
      name: EYMET_SOURCE_NAME,
      fetchEvents: fetchEymetEvents,
      categorySlugFor: inferEventCategorySlug,
      persistPendingEvent: async (event, categoryId) => {
        const { data, error: insertError } = await supabase.rpc("import_pending_source_events", {
          p_events: [{ ...event, category_id: categoryId }],
        });
        if (insertError) throw new Error(`Opslaan van “${event.title}” is mislukt: ${insertError.message}`);
        return data?.inserted > 0 ? "inserted" : "skipped";
      },
    }, categories ?? []);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
