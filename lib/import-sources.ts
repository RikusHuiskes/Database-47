import type { ImportedEvent } from "./tourisme-duras";

export type ImportCategory = { id: string; slug: string };

/** Contract for adding another public, structured event source. */
export type ExternalEventSource = {
  id: string;
  name: string;
  fetchEvents: () => Promise<ImportedEvent[]>;
  categorySlugFor: (event: ImportedEvent) => string | null;
  persistPendingEvent: (event: ImportedEvent, categoryId: string | null) => Promise<"inserted" | "enriched" | "skipped">;
};

export type ImportSourceSummary = {
  source: string;
  checked: number;
  inserted: number;
  enriched: number;
  skipped: number;
  skippedWithoutCategory: number;
};

export async function runExternalEventImport(
  source: ExternalEventSource,
  categories: ImportCategory[],
): Promise<ImportSourceSummary> {
  const events = await source.fetchEvents();
  const summary: ImportSourceSummary = {
    source: source.name, checked: events.length, inserted: 0, enriched: 0, skipped: 0, skippedWithoutCategory: 0,
  };
  for (const event of events) {
    const slug = source.categorySlugFor(event);
    const categoryId = categories.find((category) => category.slug === slug)?.id;
    if (!categoryId) summary.skippedWithoutCategory += 1;
    const result = await source.persistPendingEvent(event, categoryId);
    summary[result] += 1;
  }
  return summary;
}

export function inferEventCategorySlug(event: ImportedEvent): string | null {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const title = normalize(`${event.title} ${event.description ?? ""}`);
  const kind = normalize(event.source_category ?? "");
  if (/randonnee|balade|vtt|marche sportive|circuit|nature|biodiversite|jardin|paysage/.test(title) || /loisir nature/.test(kind)) return "nature-randonnee";
  if (/marche|brocante|vide-grenier|foire/.test(title) || /manifestation commerciale/.test(kind)) return "marches-brocantes";
  if (/concert|musique|chorale|jazz|opera|recital/.test(title) || /concert|musique/.test(kind)) return "concerts-musique";
  if (/theatre|spectacle|representation|cabaret|danse|cirque/.test(title) || /theatre|spectacle/.test(kind)) return "theatre-spectacles";
  if (/atelier|stage|cours|initiation/.test(title)) return "ateliers-cours";
  if (/exposition|photophore|peinture|sculpture|photograph|vernissage/.test(title)) return "art-expositions";
  if (/enfant|famille|jeunesse|kid/.test(title)) return "enfants-famille";
  if (/restaurant|repas|diner|dejeuner|choucroute|tartiflette|garbure|loto gourmand/.test(title)) return "restaurants-gastronomie";
  if (/fete|festival|carnaval|reveillon|fête/.test(title) || /animation et fete locale|fetes et manifestations/.test(kind)) return "festivals-fetes";
  if (/sports et loisirs|sport|competition|tournoi/.test(kind) || /course|match|competition|tournoi/.test(title)) return "sport";
  if (/culturelle|culture|musee|patrimoine|conference|colloque|debat|cinema|film/.test(kind)
    || /musee|patrimoine|conference|colloque|debat|cinema|film|histoire/.test(title)) return "culture-musees";
  return null;
}
