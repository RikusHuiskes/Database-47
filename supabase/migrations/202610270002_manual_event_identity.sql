-- Manual submissions may share a title and organizer URL. Imported source URLs
-- remain unique. Existing rows, slugs, source URLs and photos are untouched.
-- The legacy form is recognized by its promotion_type field, so already-open
-- deployments also benefit without having to re-enter the form.
begin;
alter table public.events add column if not exists is_manual_entry boolean not null default false;
drop index if exists public.events_source_url_unique_idx;
create unique index events_source_url_unique_idx on public.events (source_url)
  where source_url is not null and not is_manual_entry;
create or replace function public.submit_pending_event(
  p_event jsonb,
  p_category_id uuid default null::uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  new_event_id uuid := pg_catalog.gen_random_uuid();
  manual_entry boolean := coalesce(p_event->>'submission_kind' = 'manual', false)
    or (p_event ? 'promotion_type' and not (p_event ? 'source_category'));
  requested_promotion text := coalesce(nullif(p_event->>'promotion_type', ''), 'none');
begin
  if requested_promotion not in ('none', 'homepage', 'category', 'highlight') then
    raise exception 'Ongeldige promotiekeuze.';
  end if;

  insert into public.events (
    id, is_manual_entry, title, slug, short_description, description,
    start_at, end_at, venue_name, address, postcode, city,
    price_from, price_to, is_free,
    website_url, booking_url, source_url,
    latitude, longitude, contact_phone, image_url, organizer_name, source_category,
    promotion_type, promotion_status, advertiser_email,
    status, verified
  )
  values (
    new_event_id,
    manual_entry,
    p_event->>'title',
    case when manual_entry then left(coalesce(nullif(p_event->>'slug', ''), 'evenement'), 120) || '-' || new_event_id::text else p_event->>'slug' end,
    p_event->>'short_description',
    p_event->>'description',
    (p_event->>'start_at')::timestamptz,
    nullif(p_event->>'end_at', '')::timestamptz,
    p_event->>'venue_name',
    p_event->>'address',
    p_event->>'postcode',
    p_event->>'city',
    nullif(p_event->>'price_from', '')::numeric,
    nullif(p_event->>'price_to', '')::numeric,
    coalesce((p_event->>'is_free')::boolean, false),
    p_event->>'website_url',
    p_event->>'booking_url',
    p_event->>'source_url',
    nullif(p_event->>'latitude', '')::numeric,
    nullif(p_event->>'longitude', '')::numeric,
    nullif(p_event->>'contact_phone', ''),
    nullif(p_event->>'image_url', ''),
    nullif(p_event->>'organizer_name', ''),
    nullif(p_event->>'source_category', ''),
    requested_promotion,
    case when requested_promotion = 'none' then 'none' else 'requested' end,
    case when requested_promotion = 'none' then null else nullif(trim(p_event->>'advertiser_email'), '') end,
    'pending',
    false
  )
  returning id into new_event_id;

  if p_category_id is not null then
    insert into public.event_categories (event_id, category_id)
    values (new_event_id, p_category_id);
  end if;
end;
$function$;

revoke all on function public.submit_pending_event(jsonb, uuid) from public;
grant execute on function public.submit_pending_event(jsonb, uuid) to anon, authenticated;

commit;

