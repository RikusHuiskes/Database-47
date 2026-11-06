/** Mollie may return its own checkout or the official iDEAL payment page. */
export function isPaymentCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return url.hostname === 'mollie.com' || url.hostname.endsWith('.mollie.com') || url.hostname === 'pay.ideal.nl';
  } catch {
    return false;
  }
}
