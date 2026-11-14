/** Embedded database relations may be a single row, a collection, or absent. */
export function relationRows<T>(value: T | T[] | null | undefined): T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}
export function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return relationRows(value)[0] ?? null;
}
