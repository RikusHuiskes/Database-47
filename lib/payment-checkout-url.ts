/** Validate the checkout URL returned by Mollie, including its Pay by Bank provider. */
export function isPaymentCheckoutUrl(value: unknown, method?: string): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return url.hostname === 'mollie.com' || url.hostname.endsWith('.mollie.com') || url.hostname === 'pay.ideal.nl'
      || (method === 'paybybank' && url.hostname === 'checkout.instantbankpayment.com');
  } catch {
    return false;
  }
}
