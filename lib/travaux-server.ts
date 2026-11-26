import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import catalog from './data/area-catalog.json';
import centres from './data/commune-centres.json';
import { distanceInKm } from './local-area';
import { createServiceClient } from './supabase-server';

const duras = centres.find(commune => commune.code === '47086')!;
const preferred = new Map(catalog.areas.map(area => [area.code_insee, area]));
const regionalCentres = new Map(centres.map(centre => [centre.code, centre]));
for (const area of catalog.areas) {
  if (!regionalCentres.has(area.code_insee)) {
    regionalCentres.set(area.code_insee, { ...area, code: area.code_insee });
  }
}
export const travauxCommunes = Array.from(regionalCentres.values())
  .map(centre => {
    const area = preferred.get(centre.code);
    const location = area ?? centre;
    const distance = distanceInKm(duras.latitude, duras.longitude, location.latitude, location.longitude);
    return { code: centre.code, name: location.name, postcode: location.postcode, distance, featured: Boolean(area) };
  })
  .filter(commune => commune.distance <= 50)
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export const travauxEnabled = () => process.env.TRAVAUX_ENABLED === 'true';
export const travauxTestMode = () => !process.env.MOLLIE_API_KEY?.startsWith('live_');
export type TravauxDb = SupabaseClient;

export class TravauxError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function travauxJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export function travauxFailure(error: unknown) {
  return error instanceof TravauxError
    ? travauxJson({ error: error.message }, error.status)
    : travauxJson({ error: 'Service momentanément indisponible. Réessayez dans quelques instants.' }, 503);
}

export async function travauxUser(request: Request) {
  const db = travauxEnabled() && createServiceClient();
  if (!db) throw new TravauxError('Les inscriptions ne sont pas encore ouvertes.', 503);
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) throw new TravauxError('Connectez-vous pour continuer.', 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user?.email || !data.user.email_confirmed_at) {
    throw new TravauxError('Connectez-vous avec une adresse e-mail vérifiée.', 401);
  }
  return { db, user: data.user, email: data.user.email };
}

export function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw Error('Travaux database operation failed');
  return result.data;
}

export function field(value: unknown, label: string, max: number, min = 1) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw new TravauxError(`Vérifiez le champ « ${label} ».`);
  }
  return text;
}

export function phoneField(value: unknown) {
  const phone = field(value, 'téléphone', 30);
  if (!/^\+?[\d .()-]+$/.test(phone) || phone.replace(/\D/g, '').length < 8) {
    throw new TravauxError('Indiquez un numéro de téléphone valide.');
  }
  return phone;
}

export const uuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);

// Bind production to the confirmed owner of Database 47 without storing their ID in source.
const productionOwnerHash = "c3724b5cbcdb954dddd4616d5b6725d8e2d82aebb6c3fdd72b3469e752a0e64a";

export function isTravauxOwner(userId: string) {
  const configured = process.env.TRAVAUX_OWNER_USER_ID?.trim();
  if (configured) return uuid(configured) && configured.toLowerCase() === userId.toLowerCase();
  if (process.env.VERCEL_ENV !== 'production'
    || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '') !== 'https://jhzbfeyhtyzyobsxypvj.supabase.co') return false;
  return createHash('sha256').update(userId.toLowerCase()).digest('hex') === productionOwnerHash;
}
