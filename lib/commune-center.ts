import centres from "./data/commune-centres.json";
import { normalizePlaceName } from "./local-area";

const byName = new Map<string, typeof centres>();
for (const centre of centres) {
  const key = normalizePlaceName(centre.name);
  const matches = byName.get(key) ?? [];
  matches.push(centre);
  byName.set(key, matches);
}

/** Reuse the existing official snapshot before making a network request. */
export function savedCommuneCenter(city: string, postcode: string | null) {
  const candidates = byName.get(normalizePlaceName(city)) ?? [];
  const matches = postcode ? candidates.filter(centre => centre.postcode === postcode) : candidates;
  if (matches.length !== 1) return null;
  return { latitude: matches[0].latitude, longitude: matches[0].longitude };
}
