import type { MetadataRoute } from 'next';
import areaCatalog from '../lib/data/area-catalog.json';
import { CHRISTMAS_CATEGORY } from '../lib/event-period';
import { SITE_ORIGIN } from '../lib/site-sharing';

export default function robots(): MetadataRoute.Robots {
  const duras = areaCatalog.areas.find((area) => area.id === 'duras')!;
  const coordinates = { lat: String(duras.latitude), lon: String(duras.longitude) };
  // These fixed public queries render the default agenda and Christmas-market lists.
  const defaultAgenda = new URLSearchParams({
    ...coordinates,
    radius: '10',
    category: 'all',
    date_from: '',
    date_to: '',
    lang: 'source',
  });

  // The French Christmas-market page loads its public listings from this URL.
  const christmasMarkets = new URLSearchParams({
    ...coordinates,
    radius: '50',
    category: CHRISTMAS_CATEGORY.id,
    lang: 'fr',
  });

  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/api/local-areas$',
        `/api/nearby-events?${defaultAgenda}$`,
        `/api/nearby-events?${christmasMarkets}$`,
      ],
      disallow: '/api/',
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
