import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET ontbreekt in de Vercel-instellingen." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase-service-instellingen ontbreken. Voeg SUPABASE_SERVICE_ROLE_KEY toe in Vercel." }, { status: 503 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("delete_expired_events_cron");
    if (error) throw new Error(error.message);
    const {error: analyticsError} = await supabase.rpc("prune_site_analytics");
    if (analyticsError) throw new Error(`Evenementen opgeruimd; analytics opruimen mislukt: ${analyticsError.message}`);
    return NextResponse.json({ ok: true, deleted: typeof data === "number" ? data : 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
