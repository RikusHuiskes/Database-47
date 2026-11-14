import type {Dictionary, Locale} from '../../lib/i18n';
import directAdvertising from './messages/reviewed-direct-advertising.json';
import monthlyBilling from './messages/reviewed-monthly-billing.json';

const pending = new Map<Locale, Promise<Dictionary>>();

/** Send only the selected language initially; load another on an explicit switch. */
export function loadUiDictionary(locale: Locale): Promise<Dictionary> {
  const existing = pending.get(locale);
  if (existing) return existing;
  const column = locale === 'nl' ? 0 : locale === 'en' ? 1 : 2;
  const source = locale === 'nl' ? import('./messages/nl.json')
    : locale === 'en' ? import('./messages/en.json') : import('./messages/fr.json');
  const result = source.then(module => ({
    ...module.default,
    ...Object.fromEntries([...monthlyBilling, ...directAdvertising].map(row => [row[0], row[column]])),
  }));
  pending.set(locale, result);
  void result.catch(() => {if (pending.get(locale) === result) pending.delete(locale);});
  return result;
}
