import type { SupabaseClient } from '@supabase/supabase-js';
import centres from './data/commune-centres.json';
import { distanceInKm } from './local-area';
import { createServiceClient } from './supabase-server';

const duras = centres.find(commune => commune.code === '47086')!;
export const travauxCommunes = centres
  .filter(commune => distanceInKm(duras.latitude, duras.longitude, commune.latitude, commune.longitude) <= 50)
  .map(({ code, name, postcode }) => ({ code, name, postcode }))
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
