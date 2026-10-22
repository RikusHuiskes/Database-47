import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

type CategoryUpdate = {
  eventId?: unknown;
  categoryId?: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return errorResponse("Log in als beheerder om een categorie te wijzigen.", 401);

  let input: CategoryUpdate;
  try {
    input = await request.json() as CategoryUpdate;
  } catch {
    return errorResponse("De wijziging kon niet worden gelezen.", 400);
  }

  if (typeof input.eventId !== "string" || !UUID_PATTERN.test(input.eventId)) {
    return errorResponse("Het evenement heeft geen geldige identificatie.", 400);
  }
  if (input.categoryId !== null && input.categoryId !== undefined
      && (typeof input.categoryId !== "string" || !UUID_PATTERN.test(input.categoryId))) {
    return errorResponse("Kies een geldige categorie.", 400);
  }
  const categoryId = typeof input.categoryId === "string" ? input.categoryId : null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    return errorResponse("De veilige categorieopslag is niet volledig ingesteld in Vercel.", 503);
  }

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: isAdmin, error: authError } = await userClient.rpc("is_admin");
  if (authError || isAdmin !== true) {
    return errorResponse("Je beheerderssessie is ongeldig of verlopen. Log opnieuw in.", 403);
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (categoryId) {
      const { data: category, error: categoryError } = await adminClient
        .from("categories")
        .select("id")
        .eq("id", categoryId)
        .maybeSingle();
      if (categoryError) throw new Error(categoryError.message);
      if (!category) return errorResponse("De gekozen categorie bestaat niet meer.", 404);

      const { error: linkError } = await adminClient
        .from("event_categories")
        .upsert(
          { event_id: input.eventId, category_id: categoryId },
          { onConflict: "event_id,category_id", ignoreDuplicates: true }
        );
      if (linkError) throw new Error(linkError.message);

      const { error: cleanupError } = await adminClient
        .from("event_categories")
        .delete()
        .eq("event_id", input.eventId)
        .neq("category_id", categoryId);
      if (cleanupError) throw new Error(cleanupError.message);
    } else {
      const { error: clearError } = await adminClient
        .from("event_categories")
        .delete()
        .eq("event_id", input.eventId);
      if (clearError) throw new Error(clearError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return errorResponse(`Categorie opslaan mislukt: ${message}`, 502);
  }
}
