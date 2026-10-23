-- Persist events from listed public municipal calendars as unreviewed submissions.
-- The server-only cron route validates CRON_SECRET and uses the service role.
create or replace function public.sync_regional_official_pending_event(
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
  source_host text;
  target_event_id uuid;
  target_status text;
  target_verified boolean;
  event_start timestamptz := (p_event->>'start_at')::timestamptz;
  event_end timestamptz := nullif(p_event->>'end_at', '')::timestamptz;
  event_slug text := p_event->>'slug';
begin
  if event_source_url is null or event_source_url !~ '^https://[^/]+/' then
    raise exception 'Ongeldige bron-URL voor de regionale agenda-import.';
  end if;
  source_host := lower(split_part(split_part(event_source_url, '://', 2), '/', 1));
  if source_host not in (
    'www.mairie-marmande.fr',
    'www.ville-miramontdeguyenne.fr',
    'commune-de-miramont-de-guyenne.neopse-site.com',
    'www.pineuilh.fr', 'pineuilh.fr',
    'www.saintefoylagrande.fr', 'saintefoylagrande.fr'
  ) then
    raise exception 'Deze bron is niet opgenomen in de officiële agenda-import.';
  end if;
  if event_start is null
    or (event_end is not null and event_end < now())
    or (event_end is null and (event_start at time zone 'Europe/Paris')::date < (now() at time zone 'Europe/Paris')::date) then
    return 'skipped';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    event_source_url || ':' || lower(btrim(coalesce(p_event->>'title', ''))), 0
  ));
  select id, status, verified into target_event_id, target_status, target_verified
  from public.events
  where source_url = event_source_url
    and lower(btrim(title)) = lower(btrim(p_event->>'title'))
  limit 1 for update;

  if target_event_id is not null then
    if target_status <> 'pending' or target_verified is distinct from false then return 'skipped'; end if;
    update public.events set
      title = coalesce(nullif(p_event->>'title', ''), title),
      short_description = coalesce(nullif(p_event->>'short_description', ''), short_description),
      description = coalesce(nullif(p_event->>'description', ''), description),
      start_at = event_start, end_at = event_end,
      venue_name = coalesce(nullif(p_event->>'venue_name', ''), venue_name),
      address = coalesce(nullif(p_event->>'address', ''), address),
      postcode = coalesce(nullif(p_event->>'postcode', ''), postcode),
      city = coalesce(nullif(p_event->>'city', ''), city),
      website_url = coalesce(nullif(p_event->>'website_url', ''), website_url),
      booking_url = coalesce(nullif(p_event->>'booking_url', ''), booking_url),
      image_url = coalesce(nullif(p_event->>'image_url', ''), image_url),
      organizer_name = coalesce(nullif(p_event->>'organizer_name', ''), organizer_name),
      source_category = coalesce(nullif(p_event->>'source_category', ''), source_category),
      updated_at = now()
    where id = target_event_id;
    if p_category_id is not null and not exists (select 1 from public.event_categories where event_id = target_event_id) then
      insert into public.event_categories(event_id, category_id) values (target_event_id, p_category_id) on conflict do nothing;
    end if;
    return 'enriched';
  end if;

  if exists (
    select 1 from public.events
    where lower(btrim(title)) = lower(btrim(p_event->>'title'))
      and start_at = event_start
      and lower(coalesce(city, '')) = lower(coalesce(p_event->>'city', ''))
  ) then
    return 'skipped';
  end if;
  if exists (select 1 from public.events where slug = event_slug) then
    event_slug := event_slug || '-' || pg_catalog.substr(pg_catalog.md5(event_source_url), 1, 8);
  end if;

  insert into public.events (
    title, slug, short_description, description, start_at, end_at, venue_name, address, postcode, city,
    price_from, price_to, is_free, website_url, booking_url, source_url, latitude, longitude,
    contact_phone, image_url, organizer_name, source_category, status, verified
  ) values (
    p_event->>'title', event_slug, p_event->>'short_description', p_event->>'description', event_start, event_end,
    p_event->>'venue_name', p_event->>'address', p_event->>'postcode', p_event->>'city',
    nullif(p_event->>'price_from', '')::numeric, nullif(p_event->>'price_to', '')::numeric,
    coalesce((p_event->>'is_free')::boolean, false), p_event->>'website_url', p_event->>'booking_url', event_source_url,
    nullif(p_event->>'latitude', '')::numeric, nullif(p_event->>'longitude', '')::numeric,
    nullif(p_event->>'contact_phone', ''), nullif(p_event->>'image_url', ''),
    nullif(p_event->>'organizer_name', ''), nullif(p_event->>'source_category', ''), 'pending', false
  ) returning id into target_event_id;

  if p_category_id is not null then
    insert into public.event_categories(event_id, category_id) values (target_event_id, p_category_id) on conflict do nothing;
  end if;
  return 'inserted';
end;
$function$;

revoke all on function public.sync_regional_official_pending_event(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.sync_regional_official_pending_event(jsonb, uuid) to service_role;

notify pgrst, 'reload schema';
