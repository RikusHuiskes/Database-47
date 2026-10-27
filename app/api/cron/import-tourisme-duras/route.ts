import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createTourismeDurasSource } from "../../../../lib/import-sources/tourisme-duras";
import { runExternalEventImport } from "../../../../lib/import-sources";
import { createServiceClient } from "../../../../lib/supabase-server";

export const runtime = "nodejs";
export const revalidate = 0;
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET ontbreekt in de Vercel-instellingen." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !anonKey) return NextResponse.json({ error: "Supabase-configuratie ontbreekt." }, { status: 503 });

  try {
    const supabase = createServiceClient();
    const { data: categoryRows, error: categoryError } = await supabase.from("categories").select("id,slug").eq("active", true);
    if (categoryError) throw new Error(`Categorieën laden mislukt: ${categoryError.message}`);
    const source = createTourismeDurasSource(async (event, categoryId) => {
      const { data, error } = await supabase.rpc("import_pending_source_events", {
        p_events: [{ ...event, category_id: categoryId }],
      });
      if (error) throw new Error(`Opslaan van “${event.title}” mislukt: ${error.message}`);
      return data?.inserted > 0 ? "inserted" : "skipped";
    });
    const summary = await runExternalEventImport(source, categoryRows ?? []);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
