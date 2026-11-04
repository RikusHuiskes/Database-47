import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../lib/supabase-server';
import { hasAdvertisingPlacement, isDemoLayoutAdvertisement } from '../../../lib/event-presentation';
import { publicEventText, publicEventUrl } from '../../../lib/public-event-links';
import { localizePublicData, requestLocale } from '../../../lib/public-translations';
import { municipalPhoto } from '../../../lib/municipal-photos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Placement = { placement: string; starts_at: string; ends_at: string };
type PaidListingRecord = {
  id: string;
  slug: string | null;
  title: string;
  start_at: string | null;
  end_at: string | null;
  is_directory_entry: boolean | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  venue_name: string | null;
  short_description: string | null;
  description: string | null;
  image_url: string | null;
  website_url: string | null;
  booking_url: string | null;
  municipal_key: string | null;
  municipal_type: string | null;
  advertising_placements: Placement[] | null;
  promotion_type: string | null;
  promotion_status: string | null;
  promotion_start_at: string | null;
  promotion_end_at: string | null;
};

const pageSize = 500;
const selectableColumns = 'id,slug,title,start_at,end_at,is_directory_entry,city,postcode,address,venue_name,short_description,description,image_url,website_url,booking_url,municipal_key,municipal_type,advertising_placements,promotion_type,promotion_status,promotion_start_at,promotion_end_at';

/** Public carousel data is deliberately limited to approved, currently paid listings. */
export async function GET(request: NextRequest) {
  const client = createServiceClient();
  if (!client) {
    return NextResponse.json({ listings: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const records: PaidListingRecord[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from('events')
      .select(selectableColumns)
      .eq('status', 'approved')
      .eq('verified', true)
      .or('advertising_placements.not.is.null,and(promotion_type.in.(homepage,category,highlight),promotion_status.eq.active)')
      .order('id')
      .range(offset, offset + pageSize - 1);

    if (error) {
      return NextResponse.json({ listings: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }
    records.push(...((data ?? []) as unknown as PaidListingRecord[]));
    if (!data || data.length < pageSize) break;
  }

  const now = new Date();
  const hasActivePlacement = (record: PaidListingRecord, placement: string) => hasAdvertisingPlacement({
    ...record,
    start_at: record.start_at ?? '',
    is_directory_entry: record.is_directory_entry ?? false,
  }, placement, now);
  const active = records
    .filter((record) => {
      if (isDemoLayoutAdvertisement(record)) return false;
      if (!['homepage', 'category', 'highlight'].some((placement) => hasActivePlacement(record, placement))) return false;
      if (record.municipal_key || record.is_directory_entry) return true;
      const end = record.end_at || record.start_at;
      return Boolean(end && Number.isFinite(Date.parse(end)) && Date.parse(end) >= now.getTime());
    })
    .filter((record, index, all) => all.findIndex((candidate) => candidate.id === record.id) === index);

  const eventListings = active.filter((record) => !record.municipal_key);
  const municipalListings = active.filter((record) => Boolean(record.municipal_key));
  const mixed: PaidListingRecord[] = [];
  for (let index = 0; index < Math.max(eventListings.length, municipalListings.length); index += 1) {
    if (eventListings[index]) mixed.push(eventListings[index]);
    if (municipalListings[index]) mixed.push(municipalListings[index]);
  }

  const listings = mixed.map((record) => {
    const isMunicipal = Boolean(record.municipal_key);
    const placements = ['homepage', 'category', 'highlight'].filter((placement) => hasActivePlacement(record, placement));
    const mapUrl = isMunicipal
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([record.title, record.address, record.city].filter(Boolean).join(' '))}`
      : null;
    return {
      id: record.id,
      kind: isMunicipal ? 'municipal' : 'event',
      is_directory_entry: record.is_directory_entry ?? false,
      title: record.title,
      start_at: record.start_at,
      end_at: record.end_at,
      city: record.city || record.postcode || '',
      address: record.address,
      venue_name: record.venue_name,
      description: publicEventText(record.short_description || record.description || ''),
      image_url: publicEventUrl(record.image_url) || (record.municipal_key ? publicEventUrl(municipalPhoto(record.municipal_key, record.municipal_type ?? undefined)?.image_url) : null),
      href: publicEventUrl(record.website_url) || publicEventUrl(record.booking_url) || mapUrl || '#agenda',
      placements,
    };
  });

  const localized = localizePublicData({ listings }, requestLocale(request));
  return NextResponse.json(localized, {
    headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' },
  });
}
