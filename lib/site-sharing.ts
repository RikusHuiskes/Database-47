import type {Metadata} from 'next';

export const SITE_ORIGIN = 'https://www.cotededuras.com';
export const SHARE_VERSION = '20261114';
export const SITE_SHARE_URL = `${SITE_ORIGIN}/?share=${SHARE_VERSION}`;
export const SITE_SOCIAL_IMAGE = `${SITE_ORIGIN}/social-preview-${SHARE_VERSION}`;
export const siteOpenGraph: NonNullable<Metadata['openGraph']> = {
  type: 'website',
  siteName: 'Côte de Duras',
  title: 'Côte de Duras — Agenda & guide local',
  description: 'Événements, marchés et bonnes adresses dans un rayon de 50 km autour de Duras. Pour habitants et visiteurs.',
  locale: 'fr_FR',
  alternateLocale: ['en_GB', 'nl_NL'],
  images: [{url: SITE_SOCIAL_IMAGE, width: 1200, height: 630, type: 'image/png', alt: 'Côte de Duras : le château et la région. Agenda et guide local dans un rayon de 50 km.'}],
};
