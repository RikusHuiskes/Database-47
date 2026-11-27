import type { MetadataRoute } from 'next';
import areaCatalog from '../lib/data/area-catalog.json';
import { CHRISTMAS_CATEGORY } from '../lib/event-period';
import { SITE_ORIGIN } from '../lib/site-sharing';

export default function robots(): MetadataRoute.Robots {
  const duras = areaCatalog.areas.find((area) => area.id === 'duras')!;
  // The French Christmas-market page loads its public listings from this URL.
  const christmasMarkets = new URLSearchParams({
    lat: String(duras.latitude),
    lon: String(duras.longitude),
    radius: '50',
    category: CHRISTMAS_CATEGORY.id,
    lang: 'fr',
  });

  return {
    rules: {
      userAgent: '*',
      allow: ['/', `/api/nearby-events?${christmasMarkets}$`],
      disallow: '/api/',
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
