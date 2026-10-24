-- Apply to Database 47 Test first. Paid placement stays inactive until an
-- administrator has reviewed the event and confirmed payment outside the app.

alter table public.events
  add column if not exists promotion_type text not null default 'none',
  add column if not exists promotion_status text not null default 'none',
  add column if not exists advertiser_email text;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_promotion_type_check'
  ) then
    alter table public.events
      add constraint events_promotion_type_check
      check (promotion_type in ('none', 'homepage', 'category', 'highlight'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_promotion_status_check'
  ) then
    alter table public.events
      add constraint events_promotion_status_check
      check (promotion_status in ('none', 'requested', 'active', 'ended'));
  end if;
end;
$migration$;

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
  new_event_id uuid;
  requested_promotion text := coalesce(nullif(p_event->>'promotion_type', ''), 'none');
begin
  if requested_promotion not in ('none', 'homepage', 'category', 'highlight') then
    raise exception 'Ongeldige promotiekeuze.';
  end if;

  insert into public.events (
    title, slug, short_description, description,
    start_at, end_at, venue_name, address, postcode, city,
    price_from, price_to, is_free,
    website_url, booking_url, source_url,
    latitude, longitude, contact_phone, image_url, organizer_name, source_category,
    promotion_type, promotion_status, advertiser_email,
    status, verified
  )
  values (
    p_event->>'title',
    p_event->>'slug',
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
