export type LocalAreaTown = {
  id: string;
  name: string;
  postcode: string;
  latitude: number;
  longitude: number;
};

// The initial visitor area is deliberately centered on the towns named by the owner.
// Coordinates are resolved from France's official commune service at runtime.
export const LOCAL_AREA_TOWNS: LocalAreaTown[] = [
  { id: "duras", name: "Duras", postcode: "47120", latitude: 44.6764, longitude: 0.1837 },
  { id: "monteton", name: "Monteton", postcode: "47120", latitude: 44.625, longitude: 0.215 },
  { id: "eymet", name: "Eymet", postcode: "24500", latitude: 44.6685, longitude: 0.3992 },
  { id: "monsegur", name: "Monségur", postcode: "33580", latitude: 44.6507, longitude: -0.0781 },
  { id: "marmande", name: "Marmande", postcode: "47200", latitude: 44.5032, longitude: 0.1658 },
  { id: "miramont-de-guyenne", name: "Miramont-de-Guyenne", postcode: "47800", latitude: 44.6022, longitude: 0.3615 },
  { id: "pineuilh", name: "Pineuilh", postcode: "33220", latitude: 44.8351, longitude: 0.2241 },
  { id: "sainte-foy-la-grande", name: "Sainte-Foy-la-Grande", postcode: "33220", latitude: 44.8413, longitude: 0.2151 },
  { id: "agen", name: "Agen", postcode: "47000", latitude: 44.2049, longitude: 0.6212 },
  { id: "nerac", name: "Nérac", postcode: "47600", latitude: 44.1362, longitude: 0.3393 },
  { id: "villeneuve-sur-lot", name: "Villeneuve-sur-Lot", postcode: "47300", latitude: 44.4087, longitude: 0.7048 },
  { id: "tonneins", name: "Tonneins", postcode: "47400", latitude: 44.3925, longitude: 0.3129 },
  { id: "casteljaloux", name: "Casteljaloux", postcode: "47700", latitude: 44.3149, longitude: 0.0895 },
  { id: "fumel", name: "Fumel", postcode: "47500", latitude: 44.4986, longitude: 0.9657 },
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
