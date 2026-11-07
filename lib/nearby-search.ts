export const SEARCH_RADIUS_OPTIONS = [5, 10, 25, 50] as const;
export type SearchRadiusKm = (typeof SEARCH_RADIUS_OPTIONS)[number];
export const DEFAULT_SEARCH_RADIUS_KM: SearchRadiusKm = 5;

export type EventDateRange = { start: string; end: string };
const frenchCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
});

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function eventDateFilter(start = '', end = ''): { range: EventDateRange | null; error: string | null } {
  if (!start && !end) return { range: null, error: null };
  if ((start && !isCalendarDate(start)) || (end && !isCalendarDate(end))) {
    return { range: null, error: 'Vul een geldige datum in.' };
  }
  if (start && end && end < start) return { range: null, error: 'De einddatum mag niet vóór de begindatum liggen.' };
  // One filled field means one day; both bounds are inclusive.
  return { range: { start: start || end, end: end || start }, error: null };
}

function eventCalendarDay(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return isCalendarDate(value) ? value : null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? frenchCalendar.format(date) : null;
}

/** Match any event day in the requested period, using the event's French local dates. */
export function matchesEventDateRange(
  event: { start_at?: string | null; end_at?: string | null; is_directory_entry?: boolean },
  range: EventDateRange | null,
): boolean {
  if (!range) return true;
  if (event.is_directory_entry) return false;
  const start = eventCalendarDay(event.start_at);
  if (!start) return false;
  const end = eventCalendarDay(event.end_at);
  return start <= range.end && (end && end >= start ? end : start) >= range.start;
}

export function normalizeSearchRadiusKm(value: number): SearchRadiusKm {
  return SEARCH_RADIUS_OPTIONS.includes(value as SearchRadiusKm)
    ? value as SearchRadiusKm
    : DEFAULT_SEARCH_RADIUS_KM;
}

export function matchesSelectedCategory(
  categoryIds: readonly string[] | null | undefined,
  selectedCategory: string,
): boolean {
  return selectedCategory === "all" || categoryIds?.includes(selectedCategory) === true;
}

export function categoryIdsForSelection(
  categoryIds: readonly string[] | null | undefined,
  selectedCategory: string,
): string[] {
  if (selectedCategory === "all") return [...(categoryIds ?? [])];
  return matchesSelectedCategory(categoryIds, selectedCategory) ? [selectedCategory] : [];
}
