import type { ImportedEvent } from "../tourisme-duras";

export const EYMET_AGENDA_URL = "https://www.pays-bergerac-tourisme.com/fr/agenda/calendrier-des-animations/programmation-espace-culturel-leden-eymet";
export const EYMET_SOURCE_NAME = "Pays de Bergerac Tourisme — agenda L’Eden d’Eymet";
const CULTURAL_PAGE = "https://www.eymet-dordogne.fr/fr/rb/304280/lespace-culturel";
const EDEN_ADDRESS = "27 avenue de la Bastide";

function decode(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è").replace(/&ecirc;/gi, "ê").replace(/&agrave;/gi, "à")
    .replace(/&ocirc;/gi, "ô").replace(/&ugrave;/gi, "ù").replace(/&ccedil;/gi, "ç")
    .replace(/&rsquo;|&#8217;/gi, "’").replace(/&lsquo;|&#8216;/gi, "‘")
    .replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&euro;|&#8364;/gi, "€").replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&#(d+);/g, (_, number: string) => String.fromCodePoint(Number(number)))
    .replace(/&#x([da-f]+);/gi, (_, number: string) => String.fromCodePoint(Number.parseInt(number, 16)));
}

function plainText(html: string): string {
  return decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/[\u00a0\s]+/g, " ").trim();
}

function attr(html: string, name: string): string | null {
  const match = html.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"));
  return match ? decode(match[1]) : null;
}

function slug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parisTimestamp(day: number, month: number, year: number, hour = 10, minute = 0): string | null {
  const base = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (base.getUTCFullYear() !== year || base.getUTCMonth() !== month - 1 || base.getUTCDate() !== day) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", timeZoneName: "longOffset", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(base);
  const offset = parts.find((part) => part.type === "timeZoneName")?.value.match(/GMT([+-]\d{2}):(\d{2})/);
  if (!offset) return null;
  const signedMinutes = (offset[1][0] === "-" ? -1 : 1) * (Number(offset[1].slice(1)) * 60 + Number(offset[2]));
  return new Date(base.getTime() - signedMinutes * 60_000).toISOString();
}

function dateOccurrences(text: string): Array<{ start: string; end: string | null; key: string }> {
  const found: Array<{ start: string; end: string | null; key: string }> = [];
  const range = /\bdu\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+au\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\b/gi;
  for (const match of text.matchAll(range)) {
    const start = parisTimestamp(Number(match[1]), Number(match[2]), Number(match[3]));
    const end = parisTimestamp(Number(match[4]), Number(match[5]), Number(match[6]), 23, 59);
    if (start && end) found.push({ start, end, key: `${match[1]}-${match[2]}-${match[3]}` });
  }
  if (found.length) return found;

  const datePattern = /\ble\s+(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*\(à\s*(\d{1,2}):(\d{2})\))?/gi;
  for (const match of text.matchAll(datePattern)) {
    const start = parisTimestamp(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 10), Number(match[5] ?? 0));
    if (start) found.push({ start, end: null, key: `${match[1]}-${match[2]}-${match[3]}-${match[4] ?? ""}-${match[5] ?? ""}` });
  }
  return found;
}

function detailLinks(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decode(match[2]);
    const label = plainText(match[4]);
    if (!/\/fr\/diffusio\/eymet\//i.test(href) || /image|voir détail/i.test(label) && /image/i.test(label)) continue;
    try {
      const url = new URL(href, EYMET_AGENDA_URL);
      if (url.hostname === "www.pays-bergerac-tourisme.com") urls.add(url.toString());
    } catch { /* Ignore malformed links from the source page. */ }
  }
  return [...urls];
}

function eventFromDetail(html: string, sourceUrl: string, now: Date): ImportedEvent[] {
  const titleHtml = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  const title = plainText(titleHtml);
  const text = plainText(html);
  if (!title || !/\bEYMET\b/i.test(text)) return [];
  const todayParis = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const occurrences = dateOccurrences(text).filter(({ end, start }) => (end ?? start).slice(0, 10) >= todayParis);
  if (!occurrences.length) return [];

  const description = plainText(html.match(/<meta\b[^>]*name=["']description["'][^>]*>/i)?.[0] ?? "")
    || text.match(/Descriptif\s+([\s\S]{20,1500}?)(?=Informations pratiques|Ouvertures et horaires|Localisation)/i)?.[1]?.trim()
    || null;
  const address = text.match(/(?:L['’]Eden|Espace culturel)\s+(\d{1,3}[^.]{0,100}?\b24500\s+EYMET)/i)?.[1]?.trim() ?? `${EDEN_ADDRESS}, 24500 Eymet`;
  const venue = text.match(/\b(L['’]Eden|Salle Jeanne de Toulouse|Jardin de Cadix|Salle Cadix|La Gare)\b/i)?.[1] ?? "L’Eden";
  const phone = text.match(/(?:\+33|0)[ .\-\d]{8,}/)?.[0]?.replace(/[ .-]+/g, " ").trim() ?? "+33 5 53 22 22 10";
  const imageUrl = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/i)?.[0];
  const image = imageUrl ? attr(imageUrl, "content") : null;
  const bookingLink = [...html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)]
    .find((match) => /réserver|reservation/i.test(plainText(match[4])));
  const booking = bookingLink ? new URL(decode(bookingLink[2]), sourceUrl).toString() : null;
  const prices = [...text.matchAll(/(?:tarif(?:s)?\s*:?[^€]{0,50})?(\d+(?:[,.]\d{1,2})?)\s*€/gi)]
    .map((match) => Number(match[1].replace(",", "."))).filter(Number.isFinite).sort((a, b) => a - b);
  const organizer = text.match(/Proposé par\s+(.+?)(?:\s+Accessibilité|\s+Langues parlées|\s+Informations pratiques)/i)?.[1]?.trim() ?? null;
  const sourceCategory = text.match(/Calendrier des animations\s+([\wÀ-ÿ ,/'’&-]{3,100})/)?.[1]?.trim() ?? null;
  const lat = text.match(/Latitude\s*:\s*(-?\d+(?:[.,]\d+)?)/i)?.[1];
  const lon = text.match(/Longitude\s*:\s*(-?\d+(?:[.,]\d+)?)/i)?.[1];

  return occurrences.map((occurrence) => ({
    title,
    slug: `${slug(title)}-${occurrence.key.replace(/[^\d-]/g, "")}`,
    short_description: description?.slice(0, 250) ?? null,
    description,
    start_at: occurrence.start,
    end_at: occurrence.end,
    venue_name: venue,
    address,
    postcode: "24500",
    city: "Eymet",
    price_from: prices.length ? Math.min(...prices) : null,
    price_to: prices.length > 1 ? Math.max(...prices) : null,
    is_free: /entrée libre|gratuit(?:e)?/i.test(text),
    website_url: CULTURAL_PAGE,
    booking_url: booking,
    contact_phone: phone,
    image_url: image,
    organizer_name: organizer,
    source_category: sourceCategory,
    latitude: lat ? Number(lat.replace(",", ".")) : 44.668949,
    longitude: lon ? Number(lon.replace(",", ".")) : 0.397675,
    source_url: `${sourceUrl}#${occurrence.key}`,
    status: "pending",
    verified: false,
  }));
}

export async function fetchEymetEvents(now = new Date()): Promise<ImportedEvent[]> {
  const response = await fetch(EYMET_AGENDA_URL, {
    cache: "no-store",
    headers: { "user-agent": "Database47-EventImporter/1.0 (local events; source attribution included)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Pays de Bergerac Tourisme gaf HTTP ${response.status}.`);
  const urls = detailLinks(await response.text());
  if (!urls.length) throw new Error("De agenda bevat geen herkenbare Eymet-detailpagina’s; de import is afgebroken om lege resultaten te voorkomen.");

  const events: ImportedEvent[] = [];
  for (let offset = 0; offset < urls.length; offset += 5) {
    const chunk = await Promise.all(urls.slice(offset, offset + 5).map(async (url) => {
      const detail = await fetch(url, {
        cache: "no-store",
        headers: { "user-agent": "Database47-EventImporter/1.0 (local events; source attribution included)" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!detail.ok) return [];
      return eventFromDetail(await detail.text(), url, now);
    }));
    events.push(...chunk.flat());
  }
  return events;
}
