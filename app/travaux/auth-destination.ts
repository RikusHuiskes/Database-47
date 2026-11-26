import type { Locale } from '../../lib/i18n';
import { SITE_ORIGIN } from '../../lib/site-sharing';

export function travauxAuthDestination(origin: string, locale: Locale, espace: 'demandeur' | 'pro' | 'admin') {
  const canonicalOrigin = origin === 'https://cotededuras.com' ? SITE_ORIGIN : origin;
  const destination = new URL('/travaux', canonicalOrigin);
  destination.search = new URLSearchParams({ lang: locale, espace }).toString();
  return destination.href;
}
