import type { ImportedEvent } from "./tourisme-duras";

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function plainText(html: string): string {
  return decodeHtml(html.replace(/<[^>]*>/g, " ")).replace(/[\u00a0\s]+/g, " ").trim();
}

function meta(html: string, keys: string[]): string | null {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map((m) => [m[1].toLowerCase(), decodeHtml(m[3])]));
    const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? "").toLowerCase();
    if (keys.includes(key) && attrs.content?.trim()) return attrs.content.trim();
  }
  return null;
}

function jsonLdEvent(html: string): Record<string, unknown> | null {
  for (const tag of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(tag[1]);
      const objects = Array.isArray(data) ? data : Array.isArray(data?.["@graph"]) ? data["@graph"] : [data];
      const event = objects.find((value) => {
        const type = value?.["@type"];
        return (Array.isArray(type) ? type : [type]).some((entry) => typeof entry === "string" && /event/i.test(entry));
      });
      if (event) return event as Record<string, unknown>;
    } catch { /* Ignore invalid page metadata and use Open Graph fields. */ }
  }
  return null;
}

function absoluteImage(value: unknown, baseUrl: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(decodeHtml(value), baseUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

function addressText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object") return null;
  const address = value as Record<string, unknown>;
  return [address.streetAddress, address.postalCode, address.addressLocality].filter((part) => typeof part === "string" && part.trim()).join(", ") || null;
}

/** Add detail-page data while keeping the event's original citation/source_url intact. */
export function enrichImportedEventFromDetail(event: ImportedEvent, html: string, detailUrl: string): ImportedEvent {
  const structured = jsonLdEvent(html);
  const organizer = structured?.organizer;
  const location = structured?.location;
  const locationObject = Array.isArray(location) ? location[0] : location;
  const locationRecord = locationObject && typeof locationObject === "object" ? locationObject as Record<string, unknown> : null;
  const metaImage = meta(html, ["og:image", "twitter:image"]);
  const structuredImage = structured?.image;
  const image = absoluteImage(metaImage ?? (Array.isArray(structuredImage) ? structuredImage[0] : structuredImage), detailUrl)
    ?? [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => absoluteImage(match[1], detailUrl)).find(Boolean)
    ?? null;
  const description = plainText(meta(html, ["og:description", "description"]) ?? (typeof structured?.description === "string" ? structured.description : ""));
  const name = typeof organizer === "string" ? organizer : organizer && typeof organizer === "object" ? (organizer as Record<string, unknown>).name : null;
  const telephone = typeof locationRecord?.telephone === "string" ? locationRecord.telephone : null;
  const address = addressText(locationRecord?.address);
  const venueName = typeof locationRecord?.name === "string" ? locationRecord.name : null;
  const eventCategory = typeof structured?.eventType === "string" ? structured.eventType : null;

  return {
    ...event,
    short_description: event.short_description || (description ? description.slice(0, 250) : null),
    description: description || event.description,
    image_url: event.image_url || image,
    venue_name: event.venue_name || venueName,
    address: event.address || address,
    contact_phone: event.contact_phone || telephone,
    organizer_name: event.organizer_name || (typeof name === "string" ? name : null),
    source_category: event.source_category || eventCategory,
    // Keep a link to the useful event detail page; source_url continues to be
    // the original publisher's link for provenance and deduplication.
    website_url: event.website_url || detailUrl,
  };
}

export async function fetchEventDetailHtml(url: string, allowedHosts: string[]): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !allowedHosts.includes(parsed.hostname)) return null;
    const response = await fetch(parsed, {
      headers: { accept: "text/html", "user-agent": "Database47-EventImporter/1.0" },
      cache: "no-store", signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    return html.length <= 3_000_000 ? html : null;
  } catch { return null; }
}

