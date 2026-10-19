export type ImportedEvent = {
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  start_at: string;
  end_at: string | null;
  venue_name: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  price_from: number | null;
  price_to: number | null;
  is_free: boolean;
  website_url: string | null;
  booking_url: string | null;
  source_url: string;
  status: "pending";
  verified: false;
};

const MONTHS: Record<string, number> = {
  janvier: 0, janv: 0, février: 1, fevrier: 1, févr: 1, fevr: 1,
  mars: 2, avril: 3, avr: 3, mai: 4, juin: 5, juillet: 6, juil: 6,
  août: 7, aout: 7, septembre: 8, sept: 8, octobre: 9, oct: 9,
  novembre: 10, nov: 10, décembre: 11, decembre: 11, déc: 11, dec: 11,
};
const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const WEEKDAYS = "lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche";

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&", apos: "'", nbsp: " ", quot: '"', eacute: "é", egrave: "è",
    ecirc: "ê", euml: "ë", agrave: "à", acirc: "â", auml: "ä", ccedil: "ç",
    icirc: "î", iuml: "ï", ocirc: "ô", ugrave: "ù", ucirc: "û", uuml: "ü",
    oelig: "œ", apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
    ndash: "–", mdash: "—", hellip: "…", euro: "€",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === "#") {
      const hex = code[1]?.toLowerCase() === "x";
      const number = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
    }
    return named[code.toLowerCase()] ?? entity;
  });
}

function textOf(html: string): string {
  return decodeHtml(html.replace(/<\/(?:p|div|li|br|h[1-6])\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/[\u00a0\s]+/g, " ").trim();
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parisIso(year: number, month: number, day: number, hour: number, minute: number): string | null {
  const candidate = new Date(Date.UTC(year, month, day, hour, minute));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month || candidate.getUTCDate() !== day) return null;
  const paris = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "longOffset",
  }).formatToParts(candidate);
  const offset = paris.find((part) => part.type === "timeZoneName")?.value.match(/GMT([+-]\d{2}):(\d{2})/);
  if (!offset) return null;
  const sign = offset[1][0];
  const hours = offset[1].slice(1);
  const mins = offset[2];
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${sign}${hours}:${mins}`;
}

/** Parses the explicit calendar dates in the French date label. Recurring or vague labels return null. */
export function parseFrenchEventDate(label: string, now = new Date()): { start_at: string; end_at: string | null } | null {
  const normalized = label.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
  const monthRegex = new RegExp(`\\b(${MONTH_PATTERN})(?:(?:\\.(?=\\s|,|$))|\\b)`, "giu");
  const monthMatches = [...normalized.matchAll(monthRegex)];
  if (monthMatches.length === 0) return null;

  const yearMatches = [...normalized.matchAll(/\b(20\d{2})\b/g)];
  const explicitYear = yearMatches.length ? Number(yearMatches[yearMatches.length - 1][1]) : null;
  const timeMatch = normalized.match(/\b(\d{1,2})\s*h(?:\s*(\d{2}))?\b/i);
  const hour = timeMatch ? Number(timeMatch[1]) : 10;
  const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0;
  if (hour > 23 || minute > 59) return null;

  const parseDayBefore = (start: number, end: number): number | null => {
    const section = normalized.slice(start, end);
    const candidates = [...section.matchAll(new RegExp(`(?:${WEEKDAYS}\\s*)?(\\d{1,2})(?:er)?`, "giu"))];
    if (!candidates.length) return null;
    return Number(candidates[candidates.length - 1][1]);
  };

  const firstMonth = monthMatches[0];
  const firstMonthNumber = MONTHS[firstMonth[1].replace(/\.$/, "")];
  let startDay = parseDayBefore(0, firstMonth.index ?? 0);
  let startMonth = firstMonthNumber;
  let endDay: number | null = null;
  let endMonth: number | null = null;

  if (monthMatches.length >= 2) {
    endDay = parseDayBefore(firstMonth.index! + firstMonth[0].length, monthMatches[1].index!);
    endMonth = MONTHS[monthMatches[1][1].replace(/\.$/, "")];
  } else {
    const before = normalized.slice(0, firstMonth.index);
    const dayMatches = [...before.matchAll(new RegExp(`(?:${WEEKDAYS}\\s*)?(\\d{1,2})(?:er)?`, "giu"))];
    if (dayMatches.length >= 2 && /\b(?:au|jusqu['’]au|to)\b/.test(before)) {
      startDay = Number(dayMatches[dayMatches.length - 2][1]);
      endDay = Number(dayMatches[dayMatches.length - 1][1]);
    } else if (/\bdu\b/.test(normalized) && dayMatches.length >= 2) {
      startDay = Number(dayMatches[dayMatches.length - 2][1]);
      endDay = Number(dayMatches[dayMatches.length - 1][1]);
    }
    if (endDay != null) endMonth = startMonth;
  }

  if (!startDay || startDay > 31) return null;
  if (endDay != null && endDay > 31) return null;

  let year = explicitYear ?? now.getFullYear();
  let endYear = year;
  if (endDay != null && endMonth != null && endMonth < startMonth) {
    if (explicitYear) {
      year = explicitYear - 1;
      endYear = explicitYear;
    } else {
      const endDateThisYear = new Date(year, endMonth, endDay, hour, minute);
      if (endDateThisYear.getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000) endYear += 1;
      year = endYear - 1;
    }
  } else if (!explicitYear) {
    const relevantMonth = endDay != null && endMonth != null ? endMonth : startMonth;
    const relevantDay = endDay != null && endMonth != null ? endDay : startDay;
    const relevantDate = new Date(year, relevantMonth, relevantDay, hour, minute);
    if (relevantDate.getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000) {
      year += 1;
      endYear = year;
    }
  }
  const startAt = parisIso(year, startMonth, startDay, hour, minute);
  const endAt = endDay == null || endMonth == null ? null : parisIso(endYear, endMonth, endDay, hour, minute);
  if (!startAt || (endDay != null && !endAt)) return null;
  return { start_at: startAt, end_at: endAt };
}

function absoluteUrl(href: string, base: string): string | null {
  try {
    const parsed = new URL(decodeHtml(href), base);
    return parsed.hostname === "www.tourismeduras.com" || parsed.hostname === "tourismeduras.com" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function parseTourismeDurasHtml(html: string, now = new Date()): ImportedEvent[] {
  const cardPattern = /<[^>]+id=["']enter_title\d+["'][^>]*>[\s\S]*?(?=<[^>]+id=["']enter_title\d+["']|$)/gi;
  const cards = html.match(cardPattern) ?? [];
  const events: ImportedEvent[] = [];
  const seenUrls = new Set<string>();

  for (const card of cards) {
    const cardText = textOf(card);
    const titleMatch = card.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const title = titleMatch ? textOf(titleMatch[1]) : "";
    const dateMatch = cardText.match(/Date\s*:\s*(.+?)(?=\s+(?:Type de manifestation|Téléphone|Tel mobile)\s*:|$)/i);
    const dateText = dateMatch?.[1]?.trim() ?? "";
    const parsedDate = parseFrenchEventDate(dateText, now);
    if (!title || !parsedDate) continue;
    const todayInParis = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const finalDate = (parsedDate.end_at ?? parsedDate.start_at).slice(0, 10);
    if (finalDate < todayInParis) continue;

    const infoLink = [...card.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .find((match) => /plus d['’]informations/i.test(textOf(match[2])));
    const titleLink = [...card.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .find((match) => textOf(match[2]).includes(title));
    const sourceUrl = absoluteUrl(infoLink?.[1] ?? titleLink?.[1] ?? "", "https://www.tourismeduras.com");
    if (!sourceUrl || seenUrls.has(sourceUrl)) continue;
    seenUrls.add(sourceUrl);

    const communeMatch = cardText.match(/Commune\s*:\s*(.+?)(?=\s+Date\s*:|$)/i);
    const city = communeMatch ? communeMatch[1].trim() : null;
    const paragraphs = [...card.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => textOf(match[1]))
      .filter((text) => text && text !== title && !/^(Commune|Date|Type de manifestation|Téléphone|Tel mobile|Plus d'informations)\s*:/i.test(text));
    const description = paragraphs.join("\n\n").slice(0, 2000) || null;
    events.push({
      title, slug: slugify(title), short_description: description?.slice(0, 250) ?? null,
      description, start_at: parsedDate.start_at, end_at: parsedDate.end_at,
      venue_name: null, address: null, postcode: null, city,
      price_from: null, price_to: null, is_free: false, website_url: null,
      booking_url: null, source_url: sourceUrl, status: "pending", verified: false,
    });
  }
  return events;
}
