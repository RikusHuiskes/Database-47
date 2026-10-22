import type { ImportedEvent } from "../tourisme-duras";

// PDF.js 5 creates a DOMMatrix at module load time, even when only extracting
// text. Vercel's Node runtime has no browser DOMMatrix, so provide the affine
// matrix operations PDF.js needs before loading it. (No canvas rendering is
// used by this importer.)
class PdfDomMatrix {
  a: number; b: number; c: number; d: number; e: number; f: number;

  constructor(values?: number[] | string) {
    const matrix = typeof values === "string" ? values.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi)?.map(Number) : values;
    [this.a, this.b, this.c, this.d, this.e, this.f] = matrix?.length === 6 ? matrix as [number, number, number, number, number, number] : [1, 0, 0, 1, 0, 0];
  }

  multiplySelf(other: PdfDomMatrix) {
    const { a, b, c, d, e, f } = this;
    this.a = a * other.a + c * other.b; this.b = b * other.a + d * other.b;
    this.c = a * other.c + c * other.d; this.d = b * other.c + d * other.d;
    this.e = a * other.e + c * other.f + e; this.f = b * other.e + d * other.f + f;
    return this;
  }

  preMultiplySelf(other: PdfDomMatrix) {
    const result = new PdfDomMatrix([other.a, other.b, other.c, other.d, other.e, other.f]).multiplySelf(this);
    Object.assign(this, result);
    return this;
  }

  translate(tx = 0, ty = 0) { return new PdfDomMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).multiplySelf(new PdfDomMatrix([1, 0, 0, 1, tx, ty])); }
  scale(scaleX = 1, scaleY = scaleX) { return new PdfDomMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).multiplySelf(new PdfDomMatrix([scaleX, 0, 0, scaleY, 0, 0])); }

  invertSelf() {
    const determinant = this.a * this.d - this.b * this.c;
    if (!determinant) throw new Error("Cannot invert a singular PDF matrix.");
    const { a, b, c, d, e, f } = this;
    this.a = d / determinant; this.b = -b / determinant; this.c = -c / determinant; this.d = a / determinant;
    this.e = (c * f - d * e) / determinant; this.f = (b * e - a * f) / determinant;
    return this;
  }
}

async function loadPdfJs() {
  if (!(globalThis as typeof globalThis & { DOMMatrix?: unknown }).DOMMatrix) {
    Object.assign(globalThis, { DOMMatrix: PdfDomMatrix });
  }
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

export const EYMET_AGENDA_URL = "https://www.eymet-dordogne.fr/fr/rb/304280/lespace-culturel";
export const EYMET_SOURCE_NAME = "Commune d’Eymet — agenda culturel officiel";
const MONTHS: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
};

type PdfItem = { str?: string; transform?: number[]; height?: number };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function linesFrom(items: PdfItem[]): string[] {
  const positioned = items.flatMap((item) => {
    const text = item.str?.replace(/\s+/g, " ").trim();
    return text ? [{ x: item.transform?.[4] ?? 0, y: item.transform?.[5] ?? 0, text }] : [];
  }).sort((a, b) => b.y - a.y);
  const lines: Array<{ y: number; parts: Array<{ x: number; text: string }> }> = [];
  for (const part of positioned) {
    const line = lines[lines.length - 1];
    if (!line || Math.abs(line.y - part.y) >= 2.5) {
      lines.push({ y: part.y, parts: [{ x: part.x, text: part.text }] });
    } else {
      line.parts.push({ x: part.x, text: part.text });
    }
  }
  return lines
    .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function dateFromLine(line: string, context: { month: number; seasonStartYear: number }): { start: string; end: string | null; day: number } | null {
  const datePart = line.split(/\s+[–—-]\s+/)[0];
  const normalized = normalize(datePart);
  const monthMatch = normalized.match(/\b(jan(?:vier)?|fev(?:rier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|aou?t|sep(?:tembre)?|oct(?:obre)?|nov(?:embre)?|dec(?:embre)?)\b/);
  const weekdayPattern = /\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/;
  if (!monthMatch && !weekdayPattern.test(normalized)) return null;
  let month = context.month;
  if (monthMatch) month = MONTHS[monthMatch[1]] ?? month;
  const explicitYear = normalized.match(/\b20\d{2}\b/)?.[0];
  const year = explicitYear ? Number(explicitYear) : (month >= 9 ? context.seasonStartYear : context.seasonStartYear + 1);
  const days = [...normalized.matchAll(/\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})(?:er)?\b/g)].map((match) => Number(match[1]));
  if (!days.length && monthMatch) {
    const dayBeforeMonth = normalized.match(/\b(\d{1,2})(?:er)?\s+(?:jan(?:vier)?|fev(?:rier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|aou?t|sep(?:tembre)?|oct(?:obre)?|nov(?:embre)?|dec(?:embre)?)\b/);
    if (dayBeforeMonth) days.push(Number(dayBeforeMonth[1]));
  }
  if (!days.length || month < 1 || month > 12 || year < 2020 || year > 2100) return null;
  const day = days[0];
  const start = parisTimestamp(year, month, day, 0, 0);
  if (!start) return null;
  const endDay = days.length > 1 && /\b(?:au|et)\b/.test(normalized) ? days[days.length - 1] : null;
  const end = endDay ? parisTimestamp(year, month, endDay, 23, 59) : null;
  if (endDay && !end) return null;
  return { start, end, day };
}

function parisTimestamp(year: number, month: number, day: number, hour: number, minute: number): string | null {
  const base = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (base.getUTCFullYear() !== year || base.getUTCMonth() !== month - 1 || base.getUTCDate() !== day) return null;
  const offsetText = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", timeZoneName: "longOffset", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(base).find((part) => part.type === "timeZoneName")?.value;
  const offset = offsetText?.match(/GMT([+-]\d{2}):(\d{2})/);
  if (!offset) return null;
  const minutes = (offset[1][0] === "-" ? -1 : 1) * (Number(offset[1].slice(1)) * 60 + Number(offset[2]));
  return new Date(base.getTime() - minutes * 60_000).toISOString();
}

function isUpcoming(date: { start: string; end: string | null }, now: Date) {
  if (date.end) return new Date(date.end).getTime() >= now.getTime();
  const localDate = (value: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
  return localDate(new Date(date.start)) >= localDate(now);
}

function cleanTitle(value: string) {
  return value
    .replace(/\.{3,}.*$/, "")
    .replace(/\s+\d{1,2}\s*$/, "")
    .replace(/\s+(?:tout public|tout-petit|dès?\s+\d+\s+ans)\s*$/i, "")
    .replace(/\s+\d{1,2}\s*€\s*\/\s*\d{1,2}\s*€\s*$/i, "")
    .replace(/^[-–—\s]+|[-–—\s]+$/g, "")
    .trim();
}

function looksLikeTitle(value: string) {
  const title = cleanTitle(value);
  const normalized = normalize(title);
  // The calendar PDF has long descriptions and contact details near date
  // blocks. A dated line can be adjacent to those paragraphs in extracted
  // text, so only accept plausible heading-like lines as event titles.
  return title.length >= 4
    && title.length <= 90
    && !/^[a-zà-ÿ]/u.test(title)
    && !/[.!?;:]$/.test(title)
    && !/(?:@|https?:\/\/|www\.)/i.test(title)
    && !/^(?:programmé|residence|duree|plein|reduit|tout public|a partir|samedi|dimanche|vendredi|octobre|novembre|decembre|janvier|fevrier|mars|avril|mai|juin|juillet|septembre|202\d|facebook|contact|tel\b|telephone|a l evenement|revisites par|sublimer chaque|des spectacles|creee en|l association|association|www\.)/i.test(normalized)
    && !/\b(?:proposant|seront au rendez|vous faire vivre|organise|organisent|retrouver les|contactez|renseignements)\b/i.test(normalized);
}

function slug(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function duplicateKey(value: string) {
  // The PDF index and detailed calendar sometimes spell the same show with
  // slightly different apostrophes or pluralization.
  return normalize(value).replace(/[^a-z0-9]/g, "").replace(/s/g, "");
}

async function officialPdfUrl(): Promise<string> {
  const response = await fetch(EYMET_AGENDA_URL, { cache: "no-store", headers: { accept: "text/html" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`De officiële gemeentepagina gaf HTTP ${response.status}.`);
  const html = await response.text();
  const links = [...html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)];
  // The page may contain an agenda navigation link before the actual PDF.
  // Prefer the municipal file-download link explicitly labelled as a PDF.
  const match = links.find((item) => /\.pdf\b/i.test(item[2] + item[4]))
    ?? links.find((item) => /agenda|culturel|eden/i.test(item[1] + item[3] + item[4]));
  if (!match) throw new Error("De officiële gemeentepagina bevat geen link naar het actuele agenda-PDF.");
  const url = new URL(match[2].replace(/&amp;/g, "&"), EYMET_AGENDA_URL);
  if (url.protocol !== "https:" || !["www.eymet-dordogne.fr", "eymet-dordogne.fr", "api.neopse.com"].includes(url.hostname)) {
    throw new Error("De agenda-PDF-link op de gemeentepagina is ongeldig.");
  }
  return url.toString();
}

export async function fetchEymetEvents(now = new Date()): Promise<ImportedEvent[]> {
  let pdfUrl: string;
  try {
    pdfUrl = await officialPdfUrl();
  } catch (error) {
    throw new Error(`De officiële agenda van de gemeente Eymet kon niet worden opgehaald: ${error instanceof Error ? error.message : "verbindingsfout"}`);
  }
  const response = await fetch(pdfUrl, { cache: "no-store", headers: { accept: "application/pdf,*/*" }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`Het gemeentelijke agenda-PDF gaf HTTP ${response.status}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    const contentType = response.headers.get("content-type") ?? "onbekend bestandstype";
    throw new Error(`De officiële PDF-link leverde geen geldig PDF-bestand op (${contentType}; ${new URL(pdfUrl).hostname}).`);
  }

  const { getDocument } = await loadPdfJs();
  const pdf = await getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
  const byDate = new Map<string, ImportedEvent>();
  let month = 0;
  let seasonStartYear = new Date(now).getFullYear();
  let sequence = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    // These are the agenda index, the full Jazz Off calendar, and the
    // additional dated events pages. The detailed show pages repeat entries
    // and are deliberately excluded to avoid manufacturing duplicate events.
    if (![4, 5, 26, 27, 28, 29, 30, 31, 32].includes(pageNumber)) continue;
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = linesFrom(content.items as PdfItem[]);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const heading = normalize(line).match(/\b(jan(?:vier)?|fev(?:rier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|aou?t|sep(?:tembre)?|oct(?:obre)?|nov(?:embre)?|dec(?:embre)?)\s+(20\d{2})\b/);
      if (heading) {
        month = MONTHS[heading[1]] ?? month;
        if (month >= 9) seasonStartYear = Number(heading[2]);
      }
      const date = dateFromLine(line, { month, seasonStartYear });
      if (!date) continue;

      let title = "";
      const sameLine = cleanTitle(line.match(/[–—]\s*(.+)$/)?.[1] ?? "");
      if (looksLikeTitle(sameLine)) title = sameLine;
      if (!title) {
        for (const nearby of [lines[index + 1], lines[index - 1], lines[index + 2], lines[index - 2]]) {
          if (!nearby) continue;
          const candidate = cleanTitle(nearby);
          if (looksLikeTitle(candidate)) { title = candidate; break; }
        }
      }
      if (!title) continue;
      const normalizedTitle = slug(title);
      if (["saison-culturelle", "culturelle", "programmé-par-la-ville", "programme", "informations"].includes(normalizedTitle)) continue;
      if (!isUpcoming(date, now)) continue;

      // Link to the original official agenda PDF so each imported item has
      // verifiable provenance; the municipal landing page remains website_url.
      const sourceUrl = pdfUrl;
      const key = `${duplicateKey(title)}:${date.start.slice(0, 10)}`;
      if (byDate.has(key)) continue;
      sequence += 1;
      byDate.set(key, {
        title,
        slug: `${normalizedTitle}-${date.start.slice(0, 10)}-${sequence}`,
        short_description: null,
        description: `Evenement vermeld in de officiële agenda van de gemeente Eymet. Controleer de bron voor de exacte aanvangstijd, locatie en actuele informatie.`,
        start_at: date.start,
        end_at: date.end,
        venue_name: "Locatie in Eymet — controleren bij de bron",
        address: null,
        postcode: "24500",
        city: "Eymet",
        price_from: null,
        price_to: null,
        is_free: false,
        website_url: EYMET_AGENDA_URL,
        booking_url: null,
        contact_phone: "+33 5 53 22 22 10",
        image_url: null,
        organizer_name: "Commune d’Eymet",
        source_category: "Agenda municipal",
        latitude: null,
        longitude: null,
        source_url: sourceUrl,
        status: "pending",
        verified: false,
      });
    }
  }
  await pdf.destroy();
  if (!byDate.size) throw new Error("Er zijn geen toekomstige evenementen uit de officiële Eymet-agenda herkend. Er is niets geïmporteerd om onjuiste invoer te voorkomen.");
  return [...byDate.values()].sort((a, b) => a.start_at.localeCompare(b.start_at));
}
