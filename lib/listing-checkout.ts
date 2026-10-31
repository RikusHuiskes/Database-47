// The owner token stays in the Authorization header, never in a payment URL.
export async function requestListingCheckout(fragment: string, fetcher: typeof fetch = fetch) {
  const access = fragment.match(/^([a-f0-9-]{36}):([A-Za-z0-9_-]{43})$/i);
  if (!access) throw Error('De betaaltoegang ontbreekt. Gebruik de bewaarde persoonlijke beheerlink.');
  const response = await fetcher('/api/mollie/checkout', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + access[2], 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: access[1] }),
    cache: 'no-store',
  });
  let data: { checkoutUrl?: string; error?: string };
  try { data = await response.json(); }
  catch { throw Error('De betaalomgeving reageert niet. Probeer opnieuw; je aanvraag is al opgeslagen.'); }
  if (!response.ok) throw Error(data.error || 'Mollie kon niet worden geopend. Probeer opnieuw.');
  if (typeof data.checkoutUrl !== 'string' || !/^https:\/\/([a-z0-9-]+\.)*mollie\.com\//i.test(data.checkoutUrl)) {
    throw Error('Er is geen geldige Mollie-betaallink ontvangen. Probeer opnieuw.');
  }
  return data.checkoutUrl;
}

export type ListingPaymentSummary = {
  placement: 'homepage' | 'category' | 'highlight';
  amountCents: number;
  startDate: string;
  endDate: string;
  months: number;
};

export const advertisingPlacementName = (placement: ListingPaymentSummary['placement']) =>
  placement === 'homepage' ? 'Homepagevermelding' : placement === 'category' ? 'Categorievermelding' : 'Vetomrande vermelding';

export const formatAdvertisingAmount = (amountCents: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amountCents / 100);
