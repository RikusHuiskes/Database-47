import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '../lib/site-sharing';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/de-streek-beleven', '/marches-de-noel', '/gemeentegids/aanmelden', '/handleiding', '/contact'];
  if (process.env.TRAVAUX_ENABLED === 'true') paths.push('/travaux');
  return paths.map((path) => ({ url: new URL(path, SITE_ORIGIN).href }));
}
