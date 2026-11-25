import type {Metadata} from 'next';
import {SITE_ORIGIN, SITE_SHARE_URL, SHARE_VERSION, siteOpenGraph} from '../lib/site-sharing';
import DurasSite from './DurasSite';
const homeUrl = SITE_ORIGIN + '/';
const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteOpenGraph.siteName,
  url: homeUrl,
  description: siteOpenGraph.description,
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: JSON.stringify(website).replace(/</g, '\\u003c')}}
      />
      <DurasSite campaignPreview={process.env.VERCEL_ENV==='preview'} discoveryPreview travauxEnabled={process.env.TRAVAUX_ENABLED === 'true'}/>
    </>
  );
}

export async function generateMetadata({searchParams}: {searchParams: Promise<Record<string,string|string[]|undefined>>}): Promise<Metadata> {
  const query = await searchParams;
  return {alternates: {canonical: homeUrl}, openGraph: {...siteOpenGraph, url: query.share === SHARE_VERSION ? SITE_SHARE_URL : homeUrl}};
}
