-- Apply to Database 47 Test first. Do not run against production before review.

alter table public.events
  add column if not exists contact_phone text,
  add column if not exists image_url text,
  add column if not exists organizer_name text,
  add column if not exists source_category text;

-- Keep the Test category catalog aligned with the categories used by the site.
insert into public.categories (id, name, slug, sort_order, active) values
  ('d0d6bd72-a503-4ecb-a31c-bae5b267f5be', 'Festivals & Fêtes', 'festivals-fetes', 1, true),
  ('6c9d7a1a-bbe1-4d9a-8bdf-5005e60bb789', 'Marchés & Brocantes', 'marches-brocantes', 2, true),
  ('674bf725-e05a-4e71-a77d-4cc563ee1068', 'Concerts & Musique', 'concerts-musique', 3, true),
  ('c4c38a99-90ae-412e-8ab0-3bb2317539c0', 'Théâtre & Spectacles', 'theatre-spectacles', 4, true),
  ('9b44ead5-4ff9-4665-8952-62db9817d016', 'Restaurants & Gastronomie', 'restaurants-gastronomie', 5, true),
  ('dd3a7fcc-8baf-4186-a324-160118ed0b8b', 'Sport', 'sport', 6, true),
  ('4139644b-e417-4d7e-886c-522b1e9a9cb8', 'Culture & Musées', 'culture-musees', 7, true),
  ('b6f76728-f811-4927-9c71-794e05538165', 'Nature & Randonnée', 'nature-randonnee', 8, true),
  ('9848a47c-b5cd-4c6a-837c-962320c5e759', 'Enfants & Famille', 'enfants-famille', 9, true),
  ('a299ed0d-64ab-466f-b50b-9d3e07521af4', 'Art & Expositions', 'art-expositions', 10, true),
  ('85f673fa-dbf1-4a96-adf7-44864fc86665', 'Ateliers & Cours', 'ateliers-cours', 11, true),
  ('f69629ff-6eba-4b86-8c6c-516165973ae0', 'Vie locale', 'vie-locale', 12, true)
on conflict (id) do nothing;

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
begin
  insert into public.events (
    title, slug, short_description, description,
    start_at, end_at, venue_name, address, postcode, city,
    price_from, price_to, is_free,
    website_url, booking_url, source_url,
    latitude, longitude, contact_phone, image_url, organizer_name, source_category,
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

create or replace function public.enrich_pending_tourisme_event(
  p_source_url text,
  p_event jsonb,
  p_category_id uuid default null::uuid
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  target_event_id uuid;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Beheerderstoegang vereist.';
  end if;

  update public.events
  set short_description = coalesce(nullif(p_event->>'short_description', ''), short_description),
      description = coalesce(nullif(p_event->>'description', ''), description),
      venue_name = coalesce(nullif(p_event->>'venue_name', ''), venue_name),
      address = coalesce(nullif(p_event->>'address', ''), address),
      postcode = coalesce(nullif(p_event->>'postcode', ''), postcode),
      city = coalesce(nullif(p_event->>'city', ''), city),
      website_url = coalesce(nullif(p_event->>'website_url', ''), website_url),
      booking_url = coalesce(nullif(p_event->>'booking_url', ''), booking_url),
      latitude = coalesce(nullif(p_event->>'latitude', '')::numeric, latitude),
      longitude = coalesce(nullif(p_event->>'longitude', '')::numeric, longitude),
      contact_phone = coalesce(nullif(p_event->>'contact_phone', ''), contact_phone),
      image_url = coalesce(nullif(p_event->>'image_url', ''), image_url),
      organizer_name = coalesce(nullif(p_event->>'organizer_name', ''), organizer_name),
      source_category = coalesce(nullif(p_event->>'source_category', ''), source_category),
      updated_at = now()
  where source_url = p_source_url
    and status = 'pending'
    and verified = false
  returning id into target_event_id;

  if target_event_id is null then
    return false;
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.event_categories where event_id = target_event_id
  ) then
    insert into public.event_categories (event_id, category_id)
    values (target_event_id, p_category_id)
    on conflict do nothing;
  end if;

  return true;
end;
$function$;

revoke all on function public.enrich_pending_tourisme_event(text, jsonb, uuid) from public, anon;
grant execute on function public.enrich_pending_tourisme_event(text, jsonb, uuid) to authenticated;
grant execute on function public.submit_pending_event(jsonb, uuid) to anon, authenticated;
