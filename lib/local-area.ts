export type LocalAreaTown = {
  id: string;
  name: string;
  postcode: string;
};

// The initial visitor area is deliberately centered on the towns named by the owner.
// Coordinates are resolved from France's official commune service at runtime.
export const LOCAL_AREA_TOWNS: LocalAreaTown[] = [
  { id: "duras", name: "Duras", postcode: "47120" },
  { id: "monteton", name: "Monteton", postcode: "47120" },
  { id: "eymet", name: "Eymet", postcode: "24500" },
  { id: "monsegur", name: "Monségur", postcode: "33580" },
  { id: "marmande", name: "Marmande", postcode: "47200" },
  { id: "pineuilh", name: "Pineuilh", postcode: "33220" },
  { id: "sainte-foy-la-grande", name: "Sainte-Foy-la-Grande", postcode: "33220" },
];

export function normalizePlaceName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function distanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
