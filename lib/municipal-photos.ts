import photos from './data/municipal-photos.json';

export type MunicipalPhoto = {
  image_url: string;
  image_source_url?: string;
  image_credit?: string;
  image_license?: string;
  image_license_url?: string;
};
const byId: Record<string, MunicipalPhoto> = photos.photos;

// Exact catalogue IDs keep photographs attached to the right establishment.
export function municipalPhoto(id: string, type?: string): MunicipalPhoto | undefined {
  return byId[id] || (type ? byId[`${id}-${type}`] : undefined);
}
export function withMunicipalPhoto<T extends {id: string; type?: string; image_url?: string | null}>(entry: T): T & MunicipalPhoto | T {
  return entry.image_url ? entry : {...entry, ...municipalPhoto(entry.id,entry.type)};
}
