/** SIRTAQUI's published open CSV is semicolon separated, Windows-1252 and
 * contains quoted multiline fields. Never split it by lines or shift its dates. */
export function parseSirtaquiCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ";" || char === "\n" || char === "\r")) {
      row.push(field); field = "";
      if (char !== ";") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else field += char;
  }
  if (quoted) throw new Error("Onvolledig SIRTAQUI-bestand: niet-afgesloten tekstveld.");
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift()?.map(value => value.replace(/^\uFEFF/, "").trim()) ?? [];
  return rows.map(values => Object.fromEntries(headers.map((key, index) => [key, values[index]?.trim() ?? ""])));
}

export function sirtaquiLocalTimestamp(date: string, time: string): string | null {
  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const [hour, minute] = (time || "10:00").split(":").map(Number);
  const wallTime = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), hour, minute);
  const check = new Date(wallTime);
  if (!Number.isFinite(wallTime) || hour < 0 || minute < 0 || hour > 23 || minute > 59 || check.getUTCDate() !== Number(dd) || check.getUTCMonth() !== Number(mm) - 1) return null;
  let instant = wallTime;
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", timeZoneName: "longOffset", hour: "2-digit", hourCycle: "h23" });
  let offset = "+01:00";
  for (let i = 0; i < 3; i++) {
    const value = formatter.formatToParts(new Date(instant)).find(part => part.type === "timeZoneName")?.value;
    const parts = value?.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!parts) return null;
    offset = `${parts[1]}${parts[2]}:${parts[3]}`;
    instant = wallTime - (parts[1] === "+" ? 1 : -1) * (Number(parts[2]) * 60 + Number(parts[3])) * 60_000;
  }
  const output = `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offset}`;
  const local = new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(output));
  if (Number(local.find(part=>part.type==="hour")?.value)!==hour || Number(local.find(part=>part.type==="minute")?.value)!==minute) return null;
  return output;
}

export function sirtaquiCategory(row: Record<string, string>): string {
  const norm = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const kind = norm(`${row.CATEGORIE} ${row.TYPE} ${row.THEME}`);
  const title = norm(row.NOM_OFFRE ?? "");
  // Classify by the publisher's precise event type before its broad theme.
  if (/exposition|vernissage/.test(kind)) return "art-expositions";
  if (/concert|recital|musique|jazz/.test(kind)) return "concerts-musique";
  if (/theatre|spectacle|danse|cirque|cabaret/.test(kind)) return "theatre-spectacles";
  if (/atelier|stage|cours|initiation/.test(kind)) return "ateliers-cours";
  if (/marche|brocante|vide.grenier|foire|vide.dressing/.test(kind)) return "marches-brocantes";
  if (/randonnee|balade|nature|environnement/.test(kind)) return "nature-randonnee";
  if (/sport|competition|tournoi/.test(kind)) return "sport";
  if (/degustation|repas|gastronomie|restauration/.test(kind)) return "restaurants-gastronomie";
  if (/jeune public|enfant|famille/.test(kind)) return "enfants-famille";
  if (/festival|fete|carnaval|halloween/.test(kind)) return "festivals-fetes";
  if (/culture|patrimoine|visite|conference|cinema|lecture/.test(kind)) return "culture-musees";
  if (/atelier|stage|cours/.test(title)) return "ateliers-cours";
  if (/concert|jazz/.test(title)) return "concerts-musique";
  if (/exposition/.test(title)) return "art-expositions";
  return "vie-locale";
}

/** An event can genuinely belong to several published types (a food market,
 * a family workshop). Keep those links instead of losing all but one. */
export function sirtaquiCategories(row: Record<string, string>): string[] {
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const kind = normalize(`${row.CATEGORIE} ${row.TYPE} ${row.THEME}`);
  const title = normalize(row.NOM_OFFRE ?? "");
  const categories = new Set([sirtaquiCategory(row)]);
  if (/animations locales|vie locale|portes ouvertes|loto|jeux de societe|caritatif/.test(kind)) categories.add("vie-locale");
  if (/gastronomie|degustation|repas/.test(kind)) categories.add("restaurants-gastronomie");
  if (/jeune public|enfants|famille/.test(kind)) categories.add("enfants-famille");
  if (/randonnee|balade/.test(kind + " " + title)) categories.add("nature-randonnee");
  return [...categories];
}
