/** Accept a familiar www/domain address and store a complete HTTP(S) URL. */
export function normalizeWebAddress(value: string): string | null {
  const input = value.trim();
  if (!input || /^https?:\/\/$/i.test(input)) return null;
  if (/\s/.test(input) || /^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) return null;
    return url.toString();
  } catch { return null; }
}
