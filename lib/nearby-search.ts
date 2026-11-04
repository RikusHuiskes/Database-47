export const SEARCH_RADIUS_OPTIONS = [5, 10, 25, 50] as const;
export type SearchRadiusKm = (typeof SEARCH_RADIUS_OPTIONS)[number];
export const DEFAULT_SEARCH_RADIUS_KM: SearchRadiusKm = 5;

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
