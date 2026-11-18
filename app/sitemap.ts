import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '../lib/site-sharing';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/de-streek-beleven', '/marches-de-noel', '/handleiding', '/contact'];
  return paths.map((path) => ({ url: new URL(path, SITE_ORIGIN).href }));
}
