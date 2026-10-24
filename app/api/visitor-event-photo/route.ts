import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BUCKET = "visitor-event-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  // Supabase's newer `sb_secret_...` keys are API keys, not JWTs. The
  // Storage API gateway accepts them in `apikey` and mints its own short-lived
  // service-role token. The JS client also defaults to `Authorization: Bearer
  // <key>`, which makes Storage reject these keys as an invalid compact JWS.
  // This server-only client is used for Storage operations, so omit that
  // default Authorization header and keep the secret in the apikey header.
  const fetchWithApiKeyOnly: typeof fetch = async (input, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.delete("authorization");
    return fetch(input, { ...init, headers });
  };

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithApiKeyOnly },
  });
}

function isImageFile(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (type === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

async function ensureBucket(client: NonNullable<ReturnType<typeof serviceClient>>) {
  const { data, error } = await client.storage.getBucket(BUCKET);
  if (!error && data?.public) return null;
  if (!error && data && !data.public) return "De foto-opslag is nog niet goed ingesteld.";
  if (error) {
    console.error("[visitor-event-photo] bucket lookup failed", {
      message: error.message,
      statusCode: error.statusCode,
    });
  }

  const { error: createError } = await client.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_PHOTO_BYTES,
    allowedMimeTypes: Object.keys(PHOTO_EXTENSIONS),
  });
  if (createError && !/already exists|duplicate|resource exists/i.test(createError.message)) {
    console.error("[visitor-event-photo] bucket creation failed", {
      message: createError.message,
      statusCode: createError.statusCode,
    });
    return "De foto-opslag kon niet worden klaargezet. Probeer het later opnieuw.";
  }

  const bucket = await client.storage.getBucket(BUCKET);
  if (bucket.error || !bucket.data?.public) {
    console.error("[visitor-event-photo] bucket verification failed", {
      message: bucket.error?.message,
      statusCode: bucket.error?.statusCode,
      public: bucket.data?.public,
    });
    return "De foto-opslag kon niet worden klaargezet. Probeer het later opnieuw.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  const client = serviceClient();
  if (!client) {
    return NextResponse.json({ error: "Foto-upload is nog niet beschikbaar op deze preview. Je kunt de evenementtip zonder foto versturen." }, { status: 503 });
  }

  let photo: FormDataEntryValue | null;
  try {
    photo = (await request.formData()).get("photo");
  } catch {
    return NextResponse.json({ error: "De foto kon niet worden gelezen. Kies de foto opnieuw." }, { status: 400 });
  }
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "Kies eerst een foto van het evenement." }, { status: 400 });
  }
  if (photo.size === 0 || photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "De foto moet kleiner zijn dan 5 MB." }, { status: 400 });
  }

  const extension = PHOTO_EXTENSIONS[photo.type];
  if (!extension) return NextResponse.json({ error: "Kies een JPG-, PNG- of WebP-foto." }, { status: 400 });

  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (!isImageFile(photo.type, bytes)) {
    return NextResponse.json({ error: "Dit bestand is geen geldige JPG-, PNG- of WebP-foto." }, { status: 400 });
  }

  const bucketError = await ensureBucket(client);
  if (bucketError) return NextResponse.json({ error: bucketError }, { status: 503 });

  const path = `visitor-submissions/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, bytes, {
    contentType: photo.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) {
    console.error("[visitor-event-photo] upload failed", {
      message: uploadError.message,
      statusCode: uploadError.statusCode,
    });
    return NextResponse.json({ error: "De foto kon niet worden opgeslagen. Probeer het later opnieuw." }, { status: 503 });
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ path, imageUrl: data.publicUrl });
}

export async function DELETE(request: NextRequest) {
  const client = serviceClient();
  if (!client) return NextResponse.json({ error: "Foto-opslag is niet beschikbaar." }, { status: 503 });

  let path: unknown;
  try {
    path = (await request.json()).path;
  } catch {
    return NextResponse.json({ error: "Foto niet gevonden." }, { status: 400 });
  }
  if (typeof path !== "string" || !/^visitor-submissions\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path)) {
    return NextResponse.json({ error: "Foto niet gevonden." }, { status: 400 });
  }

  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) return NextResponse.json({ error: "De niet-gebruikte foto kon niet worden opgeruimd." }, { status: 503 });
  return NextResponse.json({ removed: true });
}
