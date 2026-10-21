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
  contact_phone: string | null;
  image_url: string | null;
  organizer_name: string | null;
  source_category: string | null;
  latitude: number | null;
  longitude: number | null;
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
    oelig: "œ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
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

function linesOf(html: string): string[] {
  return decodeHtml(html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td|dt|dd|section|article)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .split(/[\r\n]+/)
    .map((line) => line.replace(/[\u00a0\s]+/g, " ").trim())
    .filter(Boolean);
}

function webUrl(href: string, base: string): string | null {
  try {
    const decoded = decodeHtml(href).trim();
    const normalized = !/^[a-z][a-z\d+.-]*:/i.test(decoded) && !decoded.startsWith("/") && decoded.includes(".")
      ? `https://${decoded}`
      : decoded;
    const url = new URL(normalized, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function linkByLabel(html: string, pattern: RegExp, base: string): string | null {
  for (const match of html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (pattern.test(textOf(match[4]))) return webUrl(match[2], base);
  }
  return null;
}

function valueAfterLabel(lines: string[], label: RegExp): string | null {
  const index = lines.findIndex((line) => label.test(line));
  if (index < 0) return null;
  const inline = lines[index].replace(label, "").trim();
  if (inline) return inline;
  const next = lines[index + 1];
  return next && !/^(?:Adresse|Téléphone|Tel(?: mobile)?|Site internet|Réserver en ligne|Organisateur|Tarifs?|Informations ouverture|Longitude|Latitude)\s*:?$/i.test(next)
    ? next
    : null;
}

function elementStart(html: string, id: string): number {
  const match = new RegExp(`<[^>]+\\bid=["']${id}["'][^>]*>`, "i").exec(html);
  return match?.index ?? -1;
}

function imageFromHtml(html: string, base: string, title: string): string | null {
  const images = [...html.matchAll(/<img\b([^>]+)>/gi)].map((match) => {
    const attrs = match[1];
    const src = attrs.match(/\b(?:src|data-src)=["']([^"']+)["']/i)?.[1];
    const alt = attrs.match(/\balt=["']([^"']*)["']/i)?.[1] ?? "";
    const url = src ? webUrl(src, base) : null;
    return { url, alt: textOf(alt), raw: attrs };
  }).filter((image) => image.url && !/logo|map|carte|captcha|icon/i.test(`${image.alt} ${image.raw}`));
  const normalizedTitle = slugify(title);
  return images.find((image) => slugify(`${image.alt} ${image.url}`.split("?")[0]).includes(normalizedTitle))?.url
    ?? images.find((image) => /\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(image.url ?? ""))?.url
    ?? null;
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
    // Only roll a year-less January/February date forward when it is clearly
    // the next calendar year. Other past dates remain in the past and are
    // filtered out by the importer instead of silently becoming next year's event.
    const relevantMonth = endDay != null && endMonth != null ? endMonth : startMonth;
    const currentMonthInParis = Number(new Intl.DateTimeFormat("en", { timeZone: "Europe/Paris", month: "numeric" }).format(now)) - 1;
    if (currentMonthInParis >= 10 && relevantMonth <= 1 && relevantMonth < currentMonthInParis) {
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
    const typeMatch = card.match(/Type de manifestation\s*:\s*([^<]+)/i);
    const sourceCategory = typeMatch ? textOf(typeMatch[1]).trim() || null : null;
    const paragraphs = [...card.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => textOf(match[1]))
      .filter((text) => text && text !== title && !/^(Commune|Date|Type de manifestation|Téléphone|Tel mobile|Plus d'informations)\s*:/i.test(text));
    const description = paragraphs.join("\n\n").slice(0, 2000) || null;
    events.push({
      title, slug: `${slugify(title)}-${parsedDate.start_at.slice(0, 10)}`, short_description: description?.slice(0, 250) ?? null,
      description, start_at: parsedDate.start_at, end_at: parsedDate.end_at,
      venue_name: null, address: null, postcode: null, city,
      price_from: null, price_to: null, is_free: false, website_url: null,
      booking_url: null, contact_phone: null, image_url: imageFromHtml(card, "https://www.tourismeduras.com", title),
      organizer_name: null, source_category: sourceCategory, latitude: null, longitude: null,
      source_url: sourceUrl, status: "pending", verified: false,
    });
  }
  return events;
}

/** Adds practical details from an event's own public Tourism Duras page. */
export function enrichTourismeDurasEvent(event: ImportedEvent, html: string): ImportedEvent {
  const base = event.source_url;
  const lines = linesOf(html);
  const practicalStart = elementStart(html, "perso_pane_56");
  const locationStart = elementStart(html, "perso_pane_59");
  const descriptionStart = elementStart(html, "perso_pane_57");
  const practicalHtml = practicalStart >= 0
    ? html.slice(practicalStart, locationStart > practicalStart ? locationStart : undefined)
    : html;
  const descriptionHtml = descriptionStart >= 0
    ? html.slice(descriptionStart, practicalStart > descriptionStart ? practicalStart : undefined)
    : "";
  const practicalLines = linesOf(practicalHtml);
  const descriptionLines = linesOf(descriptionHtml);
  const descriptionIndex = descriptionLines.findIndex((line) => /^Description\s*:?\s*$/i.test(line));
  const detailDescription = descriptionIndex >= 0
    ? descriptionLines.slice(descriptionIndex + 1).filter((line) => !/^Date de (?:début|fin)\s*:/i.test(line)).join("\n\n").trim()
    : "";
  const addressIndex = practicalLines.findIndex((line) => /^Adresse\s*:?\s*$/i.test(line) || /^Adresse\s*:/i.test(line));
  const addressLines: string[] = [];
  if (addressIndex >= 0) {
    const inline = practicalLines[addressIndex].replace(/^Adresse\s*:?\s*/i, "").trim();
    if (inline) addressLines.push(inline);
    for (const line of practicalLines.slice(addressIndex + 1)) {
      if (/^(?:Téléphone|Tel(?: mobile)?|Site internet|Réserver en ligne|Organisateur|Tarifs?|Informations ouverture)\s*:?/i.test(line)) break;
      if (/\b\d{5}\b/.test(line) && addressLines.length > 0) {
        addressLines.push(line);
        break;
      }
      if (addressLines.length < 3) addressLines.push(line);
    }
  }
  const postcodeLine = addressLines.find((line) => /\b\d{5}\b/.test(line)) ?? "";
  const postcodeMatch = postcodeLine.match(/\b(\d{5})\s*(.*)$/);
  const streetLines = addressLines.filter((line) => line !== postcodeLine);
  const address = streetLines.length > 1 ? streetLines.slice(1).join(", ") : streetLines[0] ?? null;
  const venueName = streetLines.length > 1 ? streetLines[0] : null;
  const locationText = locationStart >= 0 ? linesOf(html.slice(locationStart)) : lines;
  const latitude = valueAfterLabel(locationText, /^Latitude\s*:?/i);
  const longitude = valueAfterLabel(locationText, /^Longitude\s*:?/i);
  const phone = practicalLines.find((line) => /^(?:Téléphone|Tel(?: mobile)?|Tél\.)\s*:/i.test(line));
  const phoneInline = phone?.replace(/^(?:Téléphone|Tel(?: mobile)?|Tél\.)\s*:/i, "").trim();
  const phoneIndex = phone ? practicalLines.indexOf(phone) : -1;
  const phoneValue = phoneInline || (phoneIndex >= 0 ? practicalLines[phoneIndex + 1] : null) || null;
  const tariffText = valueAfterLabel(practicalLines, /^Tarifs?\s*:?/i) ?? "";
  const prices = [...tariffText.matchAll(/(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?\b)/gi)]
    .map((match) => Number(match[1].replace(",", ".")))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const organizer = valueAfterLabel(practicalLines, /^Organisateur\s*:?/i)
    ?? textOf(practicalHtml).match(/Organisateur\s*:\s*(.+?)(?=\s+(?:Tarifs?|Langues|Mode de paiement|Capacité|Informations ouverture)\s*:?|$)/i)?.[1]?.trim()
    ?? null;
  const image = imageFromHtml(html, base, event.title);

  return {
    ...event,
    venue_name: venueName || event.venue_name,
    address: address || event.address,
    postcode: postcodeMatch?.[1] ?? event.postcode,
    city: postcodeMatch?.[2]?.trim() || event.city,
    website_url: linkByLabel(practicalHtml, /^Site internet$/i, base) ?? event.website_url,
    booking_url: linkByLabel(practicalHtml, /Réserver en ligne/i, base) ?? event.booking_url,
    contact_phone: phoneValue || event.contact_phone,
    price_from: prices.length ? prices[0] : event.price_from,
    price_to: prices.length > 1 ? prices[prices.length - 1] : event.price_to,
    is_free: prices.length ? false : /\bgratuit(?:e|s|es)?\b/i.test(tariffText) || event.is_free,
    organizer_name: organizer || event.organizer_name,
    image_url: image || event.image_url,
    latitude: latitude ? Number.parseFloat(latitude.replace(",", ".")) : event.latitude,
    longitude: longitude ? Number.parseFloat(longitude.replace(",", ".")) : event.longitude,
    description: detailDescription || event.description,
  };
}
