import { createServiceClient } from "../../../lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { EVENT_PHOTO_TYPES, eventPhotoType, isEventPhoto } from "../../../lib/event-photo";

export const runtime = "nodejs";

const BUCKET = "visitor-event-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_EXTENSIONS: Record<string, string> = EVENT_PHOTO_TYPES;

function serviceClient() {
  return createServiceClient();
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

  const contentType = eventPhotoType(photo);
  const extension = contentType ? PHOTO_EXTENSIONS[contentType] : null;
  if (!extension) return NextResponse.json({ error: "Kies een JPG-, PNG- of WebP-foto." }, { status: 400 });

  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (!contentType || !isEventPhoto(contentType, bytes)) {
    return NextResponse.json({ error: "Dit bestand is geen geldige JPG-, PNG- of WebP-foto." }, { status: 400 });
  }

  const bucketError = await ensureBucket(client);
  if (bucketError) return NextResponse.json({ error: bucketError }, { status: 503 });

  const path = `visitor-submissions/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, bytes, {
    contentType,
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
