-- Add only missing source photos. Existing photos, titles, dates, approval
-- states and category links remain unchanged.
create or replace function public.supplement_source_event_images(p_images jsonb)
returns integer language plpgsql security definer set search_path='' as $photos$
declare affected integer;
begin
 if not(coalesce(public.is_admin(),false) or coalesce(auth.role(),'')='service_role') then raise exception 'Beheerderstoegang vereist.';end if;
 if jsonb_typeof(p_images)<>'array' or jsonb_array_length(p_images)>1000 then raise exception 'Maximaal 1000 fotoverwijzingen per batch.';end if;
 with candidates as(select distinct on(source_url) source_url,image_url from jsonb_to_recordset(p_images) p(source_url text,image_url text)
 where image_url ~ '^https://[^[:space:]]+$' and length(image_url)<=2048)
 update public.events e set image_url=p.image_url from candidates p where e.source_url=p.source_url and nullif(btrim(e.image_url),'') is null;
 get diagnostics affected=row_count;
 return affected;
end $photos$;
revoke all on function public.supplement_source_event_images(jsonb) from public,anon;
grant execute on function public.supplement_source_event_images(jsonb) to authenticated,service_role;

-- Additive import; matched events only receive a missing source photo.
-- Existing photos, text, approval states and category links are preserved.
create or replace function public.import_pending_source_events(p_events jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  item jsonb; event_id uuid; source text; source_number text;
  event_start timestamptz; event_end timestamptz; candidate_slug text;
  inserted_count integer := 0; skipped_count integer := 0;
  category_slug text; category_id uuid;
begin
  if not (coalesce(public.is_admin(),false) or coalesce(auth.role(),'') = 'service_role') then
    raise exception 'Beheerderstoegang vereist.';
  end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 100 then
    raise exception 'Importeer maximaal 100 evenementen per batch.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('database47-additive-source-import',0));
  for item in select value from jsonb_array_elements(p_events) loop
    source := item->>'source_url';
    if source is null or not (
      source ~ '^https://(www\.)?tourismeduras\.com/' or
      source like 'https://www.eymet-dordogne.fr/fr/rb/304280/lespace-culturel#agenda-%' or
      source ~ '^https://aquitaine\.media\.tourinsoft\.eu/upload/SIRTAQUI-OD-liste-csv-agenda-(24|33|47)\.csv#[A-Za-z0-9_-]+$' or
      source ~ '^https://openagenda\.com/[^?#]+/events/' or
      source ~ '^https://(www\.)?(mairie-marmande\.fr|ville-miramontdeguyenne\.fr|commune-de-miramont-de-guyenne\.neopse-site\.com|pineuilh\.fr|saintefoylagrande\.fr)/'
    ) then raise exception 'Niet-ondersteunde importbron.'; end if;
    event_start := (item->>'start_at')::timestamptz;
    event_end := nullif(item->>'end_at','')::timestamptz;
    if event_start is null or nullif(btrim(item->>'title'),'') is null or (event_end is not null and event_end < event_start) then
      raise exception 'Een geldige titel en datum zijn verplicht.';
    end if;
    if (coalesce(event_end,event_start) at time zone 'Europe/Paris')::date < (now() at time zone 'Europe/Paris')::date then
      skipped_count := skipped_count + 1; continue;
    end if;
    source_number := case when source ~ '^https://(www\.)?tourismeduras\.com/' then substring(source from '/([0-9]+):') else null end;
    if exists(select 1 from public.events existing where existing.source_url=source
      or (source_number is not null and existing.source_url ~ '^https://(www\.)?tourismeduras\.com/' and substring(existing.source_url from '/([0-9]+):')=source_number)
      or (lower(btrim(existing.title))=lower(btrim(item->>'title'))
        and (existing.start_at at time zone 'Europe/Paris')::date=(event_start at time zone 'Europe/Paris')::date
        and lower(btrim(coalesce(existing.city,'')))=lower(btrim(coalesce(item->>'city',''))))) then
      perform public.supplement_source_event_images(jsonb_build_array(item));
      skipped_count := skipped_count + 1; continue;
    end if;
    candidate_slug := coalesce(nullif(item->>'slug',''),'import-'||pg_catalog.md5(source));
    if exists(select 1 from public.events where slug=candidate_slug) then
      candidate_slug := candidate_slug||'-'||pg_catalog.substr(pg_catalog.md5(source),1,12);
    end if;
    insert into public.events(title,slug,short_description,description,start_at,end_at,venue_name,address,postcode,city,
      price_from,price_to,is_free,website_url,booking_url,source_url,latitude,longitude,contact_phone,image_url,organizer_name,source_category,status,verified)
    values(item->>'title',candidate_slug,item->>'short_description',item->>'description',event_start,event_end,
      item->>'venue_name',item->>'address',item->>'postcode',item->>'city',nullif(item->>'price_from','')::numeric,nullif(item->>'price_to','')::numeric,
      coalesce((item->>'is_free')::boolean,false),item->>'website_url',item->>'booking_url',source,
      nullif(item->>'latitude','')::numeric,nullif(item->>'longitude','')::numeric,item->>'contact_phone',item->>'image_url',item->>'organizer_name',item->>'source_category','pending',false)
    returning id into event_id;
    if nullif(item->>'category_id','') is not null then
      insert into public.event_categories(event_id,category_id) values(event_id,(item->>'category_id')::uuid) on conflict do nothing;
    end if;
    for category_slug in select jsonb_array_elements_text(coalesce(item->'category_slugs','[]'::jsonb)) loop
      select id into category_id from public.categories where slug=category_slug and active=true limit 1;
      if category_id is not null then
        insert into public.event_categories(event_id,category_id) values(event_id,category_id) on conflict do nothing;
      end if;
    end loop;
    inserted_count := inserted_count + 1;
  end loop;
  return jsonb_build_object('inserted',inserted_count,'skipped',skipped_count);
end $function$;
revoke all on function public.import_pending_source_events(jsonb) from public,anon;
grant execute on function public.import_pending_source_events(jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
