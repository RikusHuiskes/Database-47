-- Apply to Database 47 Test first, then Production after reviewing the rollout.
-- Daily imports only create/update unreviewed Tourisme Duras submissions.

create or replace function public.sync_tourisme_duras_pending_event(
  p_event jsonb,
  p_category_id uuid
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  event_source_url text := p_event->>'source_url';
  target_event_id uuid;
  target_status text;
  target_verified boolean;
  event_start timestamptz := (p_event->>'start_at')::timestamptz;
  event_slug text := p_event->>'slug';
  slug_suffix text;
begin
  if event_source_url is null or event_source_url not like 'https://www.tourismeduras.com/%' then
    raise exception 'Ongeldige bron-URL voor dagelijkse Duras-import.';
  end if;

  -- Serialize identical event imports so overlapping cron retries cannot duplicate rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(event_source_url, 0));

  select id, status, verified
    into target_event_id, target_status, target_verified
  from public.events
  where source_url = event_source_url
  limit 1
  for update;

  if target_event_id is not null then
    if target_status <> 'pending' or target_verified is distinct from false then
      return 'skipped';
    end if;

    update public.events
    set title = coalesce(nullif(p_event->>'title', ''), title),
        short_description = coalesce(nullif(p_event->>'short_description', ''), short_description),
        description = coalesce(nullif(p_event->>'description', ''), description),
        start_at = event_start,
        end_at = nullif(p_event->>'end_at', '')::timestamptz,
        venue_name = coalesce(nullif(p_event->>'venue_name', ''), venue_name),
        address = coalesce(nullif(p_event->>'address', ''), address),
        postcode = coalesce(nullif(p_event->>'postcode', ''), postcode),
        city = coalesce(nullif(p_event->>'city', ''), city),
        website_url = coalesce(nullif(p_event->>'website_url', ''), website_url),
        booking_url = coalesce(nullif(p_event->>'booking_url', ''), booking_url),
        contact_phone = coalesce(nullif(p_event->>'contact_phone', ''), contact_phone),
        image_url = coalesce(nullif(p_event->>'image_url', ''), image_url),
        organizer_name = coalesce(nullif(p_event->>'organizer_name', ''), organizer_name),
        source_category = coalesce(nullif(p_event->>'source_category', ''), source_category),
        updated_at = now()
    where id = target_event_id;

    if p_category_id is not null and not exists (
      select 1 from public.event_categories where event_id = target_event_id
    ) then
      insert into public.event_categories (event_id, category_id)
      values (target_event_id, p_category_id)
      on conflict do nothing;
    end if;
    return 'enriched';
  end if;

  if exists (
    select 1 from public.events
    where lower(btrim(title)) = lower(btrim(p_event->>'title'))
      and start_at = event_start
  ) then
    return 'skipped';
  end if;

  slug_suffix := pg_catalog.substr(pg_catalog.md5(event_source_url), 1, 8);
  if exists (select 1 from public.events where slug = event_slug) then
    event_slug := event_slug || '-' || slug_suffix;
  end if;

  insert into public.events (
    title, slug, short_description, description,
    start_at, end_at, venue_name, address, postcode, city,
    price_from, price_to, is_free,
    website_url, booking_url, source_url,
    latitude, longitude, contact_phone, image_url, organizer_name, source_category,
    status, verified
  ) values (
    p_event->>'title', event_slug, p_event->>'short_description', p_event->>'description',
    event_start, nullif(p_event->>'end_at', '')::timestamptz,
    p_event->>'venue_name', p_event->>'address', p_event->>'postcode', p_event->>'city',
    nullif(p_event->>'price_from', '')::numeric, nullif(p_event->>'price_to', '')::numeric,
    coalesce((p_event->>'is_free')::boolean, false),
    p_event->>'website_url', p_event->>'booking_url', event_source_url,
    nullif(p_event->>'latitude', '')::numeric, nullif(p_event->>'longitude', '')::numeric,
    nullif(p_event->>'contact_phone', ''), nullif(p_event->>'image_url', ''),
    nullif(p_event->>'organizer_name', ''), nullif(p_event->>'source_category', ''),
    'pending', false
  ) returning id into target_event_id;

  if p_category_id is not null then
    insert into public.event_categories (event_id, category_id)
    values (target_event_id, p_category_id)
    on conflict do nothing;
  end if;

  return 'inserted';
end;
$function$;

revoke all on function public.sync_tourisme_duras_pending_event(jsonb, uuid) from public;
grant execute on function public.sync_tourisme_duras_pending_event(jsonb, uuid) to anon, authenticated;
