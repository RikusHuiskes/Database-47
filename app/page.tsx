import type {Metadata} from 'next';
import {SITE_ORIGIN, SITE_SHARE_URL, SHARE_VERSION, siteOpenGraph} from '../lib/site-sharing';
import DurasSite from './DurasSite';
export default function Page(){return <DurasSite/>;}

export async function generateMetadata({searchParams}: {searchParams: Promise<Record<string,string|string[]|undefined>>}): Promise<Metadata> {
  const query = await searchParams;
  return {alternates: {canonical: SITE_ORIGIN + '/'}, openGraph: {...siteOpenGraph, url: query.share === SHARE_VERSION ? SITE_SHARE_URL : SITE_ORIGIN + '/'}};
}
