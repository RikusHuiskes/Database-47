import type { ImportedEvent } from "../tourisme-duras";

type JsonRecord = Record<string, unknown>;
type AgendaConfig = {
  name: string;
  listingUrl: string;
  allowedHosts: string[];
  eventPath: RegExp;
  maxPages: number;
  maxEvents: number;
};
type ListingCandidate = { url: string; cardHtml: string | null; title: string | null; listingOnly?: boolean };
export type RegionalAgendaSourceReport = {
  source: string;
  pagesRead: number;
  eventPagesFound: number;
  eventPagesRead: number;
  importedCandidates: number;
  failedEventPages: number;
  error?: string;
};
export type RegionalAgendaImportFetch = { events: ImportedEvent[]; sources: RegionalAgendaSourceReport[] };

const AGENDA_CONFIGS: AgendaConfig[] = [
  {
    name: "Ville de Marmande — agenda officiel",
    listingUrl: "https://www.mairie-marmande.fr/evenements/",
    allowedHosts: ["www.mairie-marmande.fr"],
    eventPath: /^\/evenements\/.+\/$/,
    maxPages: 10,
    maxEvents: 120,
  },
  {
    name: "Commune de Miramont-de-Guyenne — agenda officiel",
    listingUrl: "https://www.ville-miramontdeguyenne.fr/fr/ev/735321/agenda-567",
    allowedHosts: ["www.ville-miramontdeguyenne.fr", "commune-de-miramont-de-guyenne.neopse-site.com"],
    eventPath: /^\/fr\/ev\/\d+\/\d+\/.+$/,
    maxPages: 10,
    maxEvents: 120,
  },
  {
    name: "Commune de Pineuilh — agenda officiel",
    listingUrl: "https://www.pineuilh.fr/manifestations-pineuilh-gironde",
    allowedHosts: ["www.pineuilh.fr", "pineuilh.fr"],
    eventPath: /^\/article_popup_\d+_\d+_.+_fr\.html$/i,
    maxPages: 10,
    maxEvents: 120,
  },
  {
    name: "Mairie de Sainte-Foy-la-Grande — agenda officiel",
    listingUrl: "https://www.saintefoylagrande.fr/tous-les-evenements/",
    allowedHosts: ["www.saintefoylagrande.fr", "saintefoylagrande.fr"],
    eventPath: /^\/agenda\/.+\/$/,
    maxPages: 10,
    maxEvents: 120,
  },
];

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1, février: 2, fevrier: 2, févr: 2, fevr: 2, fev: 2, mars: 3,
  avril: 4, avr: 4, mai: 5, juin: 6, juillet: 7, juil: 7, août: 8, aout: 8,
  septembre: 9, sept: 9, sep: 9, octobre: 10, oct: 10, novembre: 11, nov: 11,
  décembre: 12, decembre: 12, déc: 12, dec: 12,
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&", apos: "'", nbsp: " ", quot: '"', eacute: "é", egrave: "è", ecirc: "ê",
    euml: "ë", agrave: "à", acirc: "â", auml: "ä", ccedil: "ç", icirc: "î", iuml: "ï",
    ocirc: "ô", ugrave: "ù", ucirc: "û", uuml: "ü", oelig: "œ", rsquo: "’", lsquo: "‘",
    rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", euro: "€",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#")) {
      const hex = code[1]?.toLowerCase() === "x";
      const number = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(number) && number >= 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number)
        : entity;
    }
    return named[code.toLowerCase()] ?? entity;
  });
}

function visibleText(html: string): string {
  return decodeHtml(html
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td|section|article)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .replace(/[\u00a0\s]+/g, " ").trim();
}

function asRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonRecord => Boolean(item && typeof item === "object"));
  return value && typeof value === "object" ? [value as JsonRecord] : [];
}

function textValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textValue).find(Boolean) ?? null;
  if (!value || typeof value !== "object") return null;
  const item = value as JsonRecord;
  for (const key of ["@value", "name", "value", "text", "description", "url", "@id"] as const) {
    const text = textValue(item[key]);
    if (text) return text;
  }
  return null;
}

function parseJsonLd(html: string): JsonRecord[] {
  const found: JsonRecord[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const item = value as JsonRecord;
    const type = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
    if (type.some((entry) => typeof entry === "string" && /event/i.test(entry))) found.push(item);
    if (item["@graph"]) visit(item["@graph"]);
    for (const [key, child] of Object.entries(item)) if (key !== "@graph" && child && typeof child === "object") visit(child);
  };
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(decodeHtml(match[1]))); } catch { /* Ignore malformed or unrelated structured data. */ }
  }
  return found;
}

function metaContent(html: string, key: string): string | null {
  for (const match of html.matchAll(/<meta\b([^>]+)>/gi)) {
    const attrs = match[1];
    const name = attrs.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (name !== key.toLowerCase()) continue;
    const content = attrs.match(/\bcontent=["']([^"']*)["']/i)?.[1];
    if (content) return decodeHtml(content.trim());
  }
  return null;
}

function firstHeading(html: string): string | null {
  const match = html.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i);
  return match ? visibleText(match[1]) : null;
}

function slug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parisIso(dateText: string, timeText?: string | null): string | null {
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zoneText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = Number(hourText ?? timeText?.match(/\d{1,2}/)?.[0] ?? 0);
  const minute = Number(minuteText ?? timeText?.match(/\d{1,2}[:h](\d{2})/)?.[1] ?? 0);
  const second = Number(secondText ?? 0);
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day) return null;
  if (zoneText === "Z" || (zoneText && /^[+-]/.test(zoneText))) {
    const normalizedZone = zoneText === "Z" ? "Z" : zoneText.includes(":") ? zoneText : `${zoneText.slice(0, 3)}:${zoneText.slice(3)}`;
    const zoned = new Date(`${yearText}-${monthText}-${dayText}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}${normalizedZone}`);
    return Number.isNaN(zoned.getTime()) ? null : zoned.toISOString();
  }
  const offsetText = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", timeZoneName: "longOffset", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(local).find((part) => part.type === "timeZoneName")?.value;
  const offset = offsetText?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!offset) return null;
  const minutes = (offset[1] === "-" ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3]));
  return new Date(local.getTime() - minutes * 60_000).toISOString();
}

function dateFromEventText(
  value: string,
  reference: Date,
  eventTitle?: string | null,
): { start: string; end: string | null; explicitYear: boolean } | null {
  const normalized = value.normalize("NFC");
  const published = normalized.match(/(?:publi[ée]|mis\s+en\s+ligne|mise\s+en\s+ligne)\s+le\s+(\d{1,2})[\s/.-]+([a-zéû]+|\d{1,2})[\s/.-]+(20\d{2})/i);
  const publishedMonth = published ? (MONTHS[published[2].toLowerCase()] ?? Number(published[2])) : null;
  const publishedYear = published ? Number(published[3]) : null;
  const months = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
  const monthDatePattern = new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${months})\\.?\\s*(20\\d{2})?\\b`, "giu");
  const monthRangePattern = new RegExp(`\\b(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+(${months})\\.?\\s*(20\\d{2})?\\b`, "giu");
  const numericDatePattern = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})\b/g;
  const yearlessNumericDatePattern = /\b(\d{1,2})[/.\-](\d{1,2})(?![/.\-\d])/g;
  const matches: Array<{ index: number; date: string; explicitYear: boolean }> = [];

  for (const match of normalized.matchAll(monthDatePattern)) {
    const month = MONTHS[match[2].toLowerCase()];
    if (!month) continue;
    let year = match[3] ? Number(match[3]) : publishedYear ?? reference.getFullYear();
    if (!match[3] && publishedMonth && month < publishedMonth) year += 1;
    matches.push({
      index: match.index ?? 0,
      date: year + "-" + String(month).padStart(2, "0") + "-" + String(Number(match[1])).padStart(2, "0"),
      explicitYear: Boolean(match[3]),
    });
  }
  for (const match of normalized.matchAll(monthRangePattern)) {
    const month = MONTHS[match[3].toLowerCase()];
    if (!month) continue;
    let year = match[4] ? Number(match[4]) : publishedYear ?? reference.getFullYear();
    if (!match[4] && publishedMonth && month < publishedMonth) year += 1;
    const datePrefix = year + "-" + String(month).padStart(2, "0") + "-";
    const index = match.index ?? 0;
    matches.push({
      index,
      date: datePrefix + String(Number(match[1])).padStart(2, "0"),
      explicitYear: Boolean(match[4]),
    }, {
      index: index + match[0].indexOf(match[2]),
      date: datePrefix + String(Number(match[2])).padStart(2, "0"),
      explicitYear: Boolean(match[4]),
    });
  }
  for (const match of normalized.matchAll(numericDatePattern)) {
    matches.push({ index: match.index ?? 0, date: match[3] + "-" + match[2].padStart(2, "0") + "-" + match[1].padStart(2, "0"), explicitYear: true });
  }
  for (const match of normalized.matchAll(yearlessNumericDatePattern)) {
    matches.push({ index: match.index ?? 0, date: reference.getFullYear() + "-" + match[2].padStart(2, "0") + "-" + match[1].padStart(2, "0"), explicitYear: false });
  }
  const isoDatePattern = /\b(20\d{2})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;
  for (const match of normalized.matchAll(isoDatePattern)) {
    matches.push({ index: match.index ?? 0, date: match[1] + "-" + match[2] + "-" + match[3], explicitYear: true });
  }
  matches.sort((a, b) => a.index - b.index);
  const unique = matches.filter((item, index) => index === 0 || item.date !== matches[index - 1].date);
  if (!unique.length) return null;

  const titleIndex = eventTitle
    ? normalized.toLocaleLowerCase("fr").indexOf(eventTitle.trim().toLocaleLowerCase("fr"))
    : -1;
  const dateList = titleIndex >= 0
    ? unique.filter((item) => item.index >= titleIndex + eventTitle!.trim().length)
    : unique;
  if (!dateList.length) return null;
  const eventDates = dateList.slice(0, 2);
  const timeNearTitle = (titleIndex >= 0 ? normalized.slice(titleIndex, titleIndex + 500) : normalized.slice(0, 800))
    .match(/\b(?:à\s*)?(\d{1,2})(?:h|:)(\d{2})\b/i);
  const time = timeNearTitle ? `${timeNearTitle[1].padStart(2, "0")}:${timeNearTitle[2]}` : "00:00";
  const start = parisIso(`${eventDates[0].date}T${time}:00`);
  if (!start) return null;
  const rangeText = normalized.slice(eventDates[0].index, eventDates[1]?.index ?? eventDates[0].index + 50);
  const isRange = eventDates.length > 1 && (/\b(?:au|jusqu['’]au|to)\b/i.test(rangeText) || /[-–]/.test(rangeText));
  if (!isRange) return { start, end: null, explicitYear: eventDates[0].explicitYear };
  let endDate = eventDates[1].date;
  if (!eventDates[1].explicitYear && endDate < eventDates[0].date) {
    const [year, month, day] = endDate.split("-").map(Number);
    endDate = `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const endTimeMatch = normalized.slice(eventDates[1].index, eventDates[1].index + 80).match(/\b(?:à\s*)?(\d{1,2})(?:h|:)(\d{2})\b/i);
  const endDateTime = parisIso(`${endDate}T${endTimeMatch ? `${endTimeMatch[1].padStart(2, "0")}:${endTimeMatch[2]}` : "23:59"}:00`);
  return {
    start,
    end: endDateTime,
    explicitYear: eventDates[0].explicitYear && eventDates[1].explicitYear,
  };
}

function fromStructuredEvent(item: JsonRecord): Partial<ImportedEvent> | null {
  const startValue = textValue(item.startDate);
  if (!startValue) return null;
  const start = startValue.includes("T") ? parisIso(startValue) : parisIso(`${startValue}T00:00:00`);
  if (!start) return null;
  const endValue = textValue(item.endDate);
  const end = endValue ? (endValue.includes("T") ? parisIso(endValue) : parisIso(`${endValue}T23:59:00`)) : null;
  if (endValue && !end) return null;
  const location = asRecords(item.location)[0] ?? {};
  const address = asRecords(location.address)[0] ?? {};
  const offer = asRecords(item.offers)[0] ?? {};
  const image = textValue(item.image);
  const sourceCategory = [textValue(item.eventStatus), textValue(item.eventAttendanceMode), textValue(item.genre), textValue(item.keywords)]
    .filter(Boolean).join(", ") || null;
  return {
    title: textValue(item.name) ?? "",
    short_description: null,
    description: textValue(item.description),
    start_at: start,
    end_at: end,
    venue_name: textValue(location.name),
    address: textValue(address.streetAddress),
    postcode: textValue(address.postalCode),
    city: textValue(address.addressLocality),
    price_from: typeof offer.price === "number" ? offer.price : Number.isFinite(Number(offer.price)) ? Number(offer.price) : null,
    price_to: null,
    is_free: String(offer.price ?? "").trim() === "0" || /free|gratuit/i.test(textValue(offer.priceCurrency) ?? ""),
    website_url: textValue(item.url),
    booking_url: textValue(offer.url),
    contact_phone: null,
    image_url: image,
    organizer_name: textValue(item.organizer),
    source_category: sourceCategory,
    latitude: null,
    longitude: null,
  };
}

function parseEventPage(html: string, sourceUrl: string, reference: Date, listing: ListingCandidate | null = null): ImportedEvent | null {
  const structured = parseJsonLd(html).map(fromStructuredEvent).find((item) => item?.title && item.start_at);
  const heading = firstHeading(html);
  const cleanHeading = heading?.replace(/^[^:]{3,120}:\s*/, "") ?? null;
  const title = structured?.title ?? cleanHeading ?? metaContent(html, "og:title")?.replace(/\s*[|–-].*$/, "") ?? listing?.title ?? null;
  if (!title || title.length < 4) return null;
  const visible = visibleText(html);
  const detailDate = dateFromEventText(visible, reference, title);
  const listingDateText = listing?.cardHtml ? visibleText(listing.cardHtml) : null;
  const listingDate = listingDateText ? dateFromEventText(listingDateText, reference) : null;
  const date = structured?.start_at
    ? { start: structured.start_at, end: structured.end_at ?? null }
    : listingDate
      ? listingDate
      : detailDate;
  if (!date) return null;
  const listingImage = listing?.cardHtml?.match(/<img\b[^>]*?(?:src|data-src)=["']([^"']+)["'][^>]*>/i)?.[1];
  const imageUrl = structured?.image_url ?? metaContent(html, "og:image") ?? (listingImage ? decodeHtml(listingImage) : null);
  const image = imageUrl ? safeHttpsUrl(imageUrl, sourceUrl) : null;
  const shortDescription = metaContent(html, "description") ?? metaContent(html, "og:description");
  const description = structured?.description ?? shortDescription;
  const venue = structured?.venue_name ?? null;
  const city = structured?.city ?? cityFromSource(sourceUrl);
  const startDate = date.start.slice(0, 10);
  const endAt = date.end;
  const candidate: ImportedEvent = {
    title: title.trim(),
    slug: `${slug(title)}-${startDate}`,
    short_description: shortDescription,
    description,
    start_at: date.start,
    end_at: endAt,
    venue_name: venue,
    address: structured?.address ?? null,
    postcode: structured?.postcode ?? null,
    city,
    price_from: structured?.price_from ?? null,
    price_to: null,
    is_free: structured?.is_free ?? /gratuit|free/i.test(visible.slice(0, 600)),
    website_url: structured?.website_url ?? null,
    booking_url: structured?.booking_url ?? null,
    contact_phone: null,
    image_url: image,
    organizer_name: structured?.organizer_name ?? null,
    source_category: structured?.source_category ?? null,
    latitude: null,
    longitude: null,
    source_url: sourceUrl,
    status: "pending",
    verified: false,
  };
  return isUpcoming(candidate, reference) ? candidate : null;
}

function safeHttpsUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

function cityFromSource(sourceUrl: string): string | null {
  const host = new URL(sourceUrl).hostname;
  if (host.includes("marmande")) return "Marmande";
  if (host.includes("miramont")) return "Miramont-de-Guyenne";
  if (host.includes("pineuilh")) return "Pineuilh";
  if (host.includes("saintefoylagrande")) return "Sainte-Foy-la-Grande";
  return null;
}

function isUpcoming(event: ImportedEvent, now: Date): boolean {
  const end = event.end_at ? Date.parse(event.end_at) : Date.parse(event.start_at);
  if (!Number.isFinite(end)) return false;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const eventDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(event.start_at));
  return event.end_at ? end >= now.getTime() : eventDay >= today;
}

function listingCardFragments(html: string): Array<{ html: string; hrefs: string[] }> {
  const result: Array<{ html: string; hrefs: string[] }> = [];
  const stack: Array<{ tag: string; start: number; hrefs: string[]; isCard: boolean }> = [];
  const markup = html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const tagPattern = /<(\/?)([a-z][a-z0-9:-]*)\b([^>]*)>/gi;
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  for (const match of markup.matchAll(tagPattern)) {
    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    const attrs = match[3];
    const offset = match.index ?? 0;
    if (!closing) {
      if (tag === "a") {
        const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
        if (href) stack.filter((node) => node.isCard).forEach((card) => card.hrefs.push(decodeHtml(href)));
      }
      const isCard = tag === "article" || tag === "li"
        || /\b(?:event|agenda|manifestation|evenement|event-item|event-card|calendar-item)\b/i.test(attrs);
      if (!voidTags.has(tag) && !/\/\s*$/.test(attrs)) stack.push({ tag, start: offset, hrefs: [], isCard });
      continue;
    }
    let stackIndex = -1;
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index].tag === tag) { stackIndex = index; break; }
    }
    if (stackIndex < 0) continue;
    const end = offset + match[0].length;
    const closed = stack.splice(stackIndex);
    for (const node of closed) {
      if (node.isCard) result.push({ html: markup.slice(node.start, end), hrefs: [...new Set(node.hrefs)] });
    }
  }
  return result;
}

function cardFragmentsByHref(html: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const card of listingCardFragments(html)) {
    for (const href of card.hrefs) if (!result.has(href)) result.set(href, card.html);
  }
  return result;
}

function candidatesFromListing(html: string, baseUrl: string, config: AgendaConfig, reference: Date): ListingCandidate[] {
  const found = new Map<string, ListingCandidate>();
  const cards = cardFragmentsByHref(html);
  for (const match of html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const rawHref = decodeHtml(match[2]);
    const target = safeHttpsUrl(rawHref, baseUrl);
    if (!target) continue;
    const url = new URL(target);
    if (!config.allowedHosts.includes(url.hostname) || !config.eventPath.test(url.pathname)) continue;
    url.hash = "";
    const candidateUrl = url.toString();
    const title = visibleText(match[4]) || null;
    const candidateKey = candidateUrl + ":" + slug(title ?? "");
    if (!found.has(candidateKey)) {
      found.set(candidateKey, {
        url: candidateUrl,
        cardHtml: cards.get(rawHref) ?? null,
        title,
      });
    }
  }
  for (const card of listingCardFragments(html)) {
    if (card.hrefs.length || !dateFromEventText(visibleText(card.html), reference)) continue;
    const heading = firstHeading(card.html);
    const linkedText = card.html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    const emphasizedText = card.html.match(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/i)?.[1];
    const title = heading ?? (linkedText ? visibleText(linkedText) : null) ?? (emphasizedText ? visibleText(emphasizedText) : null);
    if (!title || title.length < 4) continue;
    const key = baseUrl + ":" + slug(title);
    if (!found.has(key)) found.set(key, { url: baseUrl, cardHtml: card.html, title, listingOnly: true });
  }
  return [...found.values()];
}

function nextListingPageUrl(html: string, currentPageUrl: string, config: AgendaConfig): string | null {
  const links = [...html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ href: decodeHtml(match[2]), label: visibleText(match[4]), attrs: match[1] + " " + match[3] }));
  const allowed = links.flatMap((link) => {
    const href = safeHttpsUrl(link.href, currentPageUrl);
    if (!href || !config.allowedHosts.includes(new URL(href).hostname)) return [];
    return [{ ...link, url: new URL(href) }];
  });
  const explicitNext = allowed.find((link) =>
    /(?:suivant|next|›|»)/i.test(link.label)
    || /\bnext\b|pagination-next|next-page|rel=["']next["']/i.test(link.attrs)
    || /aria-label=["'][^"']*(?:suivant|next)/i.test(link.attrs));
  if (explicitNext) return explicitNext.url.toString();

  const basePath = new URL(config.listingUrl).pathname.replace(/\/+$/, "");
  const currentUrl = new URL(currentPageUrl);
  const pathPage = (pathname: string) => Number(pathname.match(/\/page\/(\d+)\/?$/i)?.[1] ?? 1);
  const currentPage = Number(currentUrl.searchParams.get("page") ?? currentUrl.searchParams.get("paged") ?? pathPage(currentUrl.pathname));
  const numericNext = allowed
    .filter((link) => /^\d+$/.test(link.label))
    .filter((link) => link.url.pathname === currentUrl.pathname || link.url.pathname.startsWith(basePath + "/page/"))
    .map((link) => ({
      ...link,
      page: Number(link.label) || Number(link.url.searchParams.get("page") ?? link.url.searchParams.get("paged") ?? pathPage(link.url.pathname)),
    }))
    .filter((link) => link.page > currentPage)
    .sort((a, b) => a.page - b.page)[0];
  if (numericNext) return numericNext.url.toString();

  const paramNext = allowed.find((link) => {
    const samePath = link.url.pathname === currentUrl.pathname;
    const hasPageParam = ["page", "paged"].some((key) => link.url.searchParams.has(key));
    return samePath && hasPageParam && link.url.toString() !== currentUrl.toString();
  });
  return paramNext?.url.toString() ?? null;
}

async function getHtml(url: string, allowedHosts: readonly string[]): Promise<string> {
  let requestUrl = url;
  const visited = new Set<string>();
  let response: Response | null = null;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const parsedUrl = new URL(requestUrl);
    if (parsedUrl.protocol !== "https:" || !allowedHosts.includes(parsedUrl.hostname)) {
      throw new Error(`Niet-toegestane agenda-URL: ${parsedUrl.hostname}`);
    }
    if (visited.has(requestUrl)) throw new Error(`Doorverwijzingslus bij ${parsedUrl.hostname}`);
    visited.add(requestUrl);
    response = await fetch(requestUrl, {
      cache: "no-store",
      redirect: "manual",
      headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Database47-RegionalEventImporter/1.0 (+https://database-47.vercel.app)" },
      signal: AbortSignal.timeout(7_000),
    });
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    if (!location || redirects === 3) throw new Error(`Doorverwijzing niet toegestaan voor ${parsedUrl.hostname}`);
    const destination = new URL(location, requestUrl);
    if (destination.protocol !== "https:" || !allowedHosts.includes(destination.hostname)) {
      throw new Error(`Doorverwijzing naar niet-toegestane bron ${destination.hostname}`);
    }
    requestUrl = destination.toString();
  }
  if (!response) throw new Error(`Geen antwoord van ${new URL(url).hostname}`);
  if (!response.ok) throw new Error(`HTTP ${response.status} voor ${new URL(requestUrl).hostname}`);
  const html = await response.text();
  if (!html || html.length > 8_000_000) throw new Error(`Lege of onverwacht grote agenda-pagina: ${new URL(url).hostname}`);
  return html;
}

async function withConcurrency<T, R>(items: T[], concurrency: number, operation: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await operation(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function fetchConfigEvents(config: AgendaConfig, now: Date): Promise<{ events: ImportedEvent[]; report: RegionalAgendaSourceReport }> {
  const visitedPages = new Set<string>();
  const candidates = new Map<string, ListingCandidate>();
  const report: RegionalAgendaSourceReport = {
    source: config.name, pagesRead: 0, eventPagesFound: 0, eventPagesRead: 0, importedCandidates: 0, failedEventPages: 0,
  };
  let pageUrl: string | null = config.listingUrl;
  while (pageUrl && report.pagesRead < config.maxPages) {
    pageUrl = safeHttpsUrl(pageUrl, config.listingUrl);
    if (!pageUrl || visitedPages.has(pageUrl)) break;
    visitedPages.add(pageUrl);
    report.pagesRead += 1;
    let html: string;
    try {
      html = await getHtml(pageUrl, config.allowedHosts);
    } catch (error) {
      report.error = error instanceof Error ? error.message : "De agenda kon niet worden opgehaald.";
      break;
    }
    for (const candidate of candidatesFromListing(html, pageUrl, config, now)) {
      const candidateKey = candidate.url + ":" + slug(candidate.title ?? "");
      if (!candidates.has(candidateKey)) candidates.set(candidateKey, candidate);
    }
    if (candidates.size >= config.maxEvents) break;

    const nextLink = [...html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)]
      .map((match) => ({ href: decodeHtml(match[2]), label: visibleText(match[4]), attrs: `${match[1]} ${match[3]}` }))
      .find((link) => /(?:suivant|next|›|»)/i.test(link.label) || /(?:pagination-next|next-page)/i.test(link.attrs));
    const nextUrl = nextLink ? safeHttpsUrl(nextLink.href, pageUrl) : null;
    pageUrl = nextListingPageUrl(html, pageUrl, config)
      ?? (nextUrl && config.allowedHosts.includes(new URL(nextUrl).hostname) ? nextUrl : null);
  }
  const selected = [...candidates.values()].slice(0, config.maxEvents);
  report.eventPagesFound = candidates.size;
  const parsed = await withConcurrency(selected, 12, async (listing) => {
    try {
      const html = listing.listingOnly ? listing.cardHtml ?? "" : await getHtml(listing.url, config.allowedHosts);
      if (!html) return { event: null, failed: false };
      return { event: parseEventPage(html, listing.url, now, listing), failed: false };
    } catch {
      return { event: null, failed: true };
    }
  });
  report.eventPagesRead = parsed.length - parsed.filter((result) => result.failed).length;
  report.failedEventPages = parsed.filter((result) => result.failed).length;
  const unique = new Map<string, ImportedEvent>();
  for (const { event } of parsed) {
    if (!event) continue;
    const key = (event.source_url ?? "") + ":" + slug(event.title) + ":" + event.start_at;
    unique.set(key, event);
  }
  report.importedCandidates = unique.size;
  return { events: [...unique.values()], report };
}

export const REGIONAL_OFFICIAL_SOURCE_NAME = "Officiële agenda’s in de omgeving";

export async function fetchRegionalOfficialEventsWithReport(now = new Date(), selectedSource?: string): Promise<RegionalAgendaImportFetch> {
  const ids = ["marmande", "miramont", "pineuilh", "sainte-foy"];
  const configs = AGENDA_CONFIGS.filter((_config, index) => !selectedSource || ids[index] === selectedSource);
  if (!configs.length) throw new Error("Onbekende gemeentelijke agendabron.");
  const sourceResults = await Promise.all(configs.map(async (config) => {
    try { return await fetchConfigEvents(config, now); } catch (error) {
      return {
        events: [],
        report: {
          source: config.name,
          pagesRead: 0,
          eventPagesFound: 0,
          eventPagesRead: 0,
          importedCandidates: 0,
          failedEventPages: 0,
          error: error instanceof Error ? error.message : "De agenda kon niet worden verwerkt.",
        },
      };
    }
  }));
  const failedSources = sourceResults.filter((result) => result.report.error);
  if (failedSources.length === configs.length) {
    throw new Error("Geen van de officiële gemeentelijke agenda’s was bereikbaar: " + failedSources.map((result) => result.report.source + " (" + result.report.error + ")").join("; "));
  }
  const unique = new Map<string, ImportedEvent>();
  for (const event of sourceResults.flatMap((result) => result.events)) {
    const key = (event.source_url ?? "") + ":" + slug(event.title) + ":" + event.start_at;
    if (!unique.has(key)) unique.set(key, event);
  }
  return { events: [...unique.values()], sources: sourceResults.map((result) => result.report) };
}

export async function fetchRegionalOfficialEvents(now = new Date()): Promise<ImportedEvent[]> {
  return (await fetchRegionalOfficialEventsWithReport(now)).events;
}

export function createRegionalOfficialAgendasSource(
  persist: (event: ImportedEvent, categoryId: string | null) => Promise<"inserted" | "enriched" | "skipped">,
  categorySlugFor: (event: ImportedEvent) => string | null,
) {
  return {
    id: "regional-official-agendas",
    name: REGIONAL_OFFICIAL_SOURCE_NAME,
    fetchEvents: fetchRegionalOfficialEvents,
    categorySlugFor,
    persistPendingEvent: persist,
  };
}
