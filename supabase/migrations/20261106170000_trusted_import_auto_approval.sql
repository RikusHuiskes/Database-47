begin;
-- Trusted imports alone publish automatically; additions stay additive and source-validated.
CREATE OR REPLACE FUNCTION public.import_pending_source_events(p_events jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  item jsonb; event_id uuid; source text; source_number text;
  event_start timestamptz; event_end timestamptz; candidate_slug text;
  inserted_count integer := 0; skipped_count integer := 0;
  category_slug text; category_id uuid;
begin
  perform set_config('cdd.trusted_import','on',true);
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
      nullif(item->>'latitude','')::numeric,nullif(item->>'longitude','')::numeric,item->>'contact_phone',item->>'image_url',item->>'organizer_name',item->>'source_category','approved',true)
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
  perform set_config('cdd.trusted_import','off',true);
  return jsonb_build_object('inserted',inserted_count,'skipped',skipped_count);
end $function$
;
CREATE OR REPLACE FUNCTION public.import_directory_entries(p_entries jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item jsonb; cid uuid; eid uuid; existing_id uuid; inserted_count integer:=0; skipped_count integer:=0; source text;
begin
  if not (coalesce(public.is_admin(),false) or coalesce(auth.role(),'')='service_role') then raise exception 'Beheerderstoegang vereist.';end if;
  perform set_config('cdd.trusted_import','on',true);
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>100 then raise exception 'Maximaal 100 vermeldingen per batch.';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('database47-directory-import',0));
  for item in select value from jsonb_array_elements(p_entries) loop
    source:=item->>'source_url';
    if coalesce(item->>'category_slug','') not in ('hotels-chambres-hotes-gites','wijnhuizen','cafes','restaurants-gastronomie','culture-musees','nature-randonnee','sport','ateliers-cours','enfants-famille')
      or coalesce(item->>'source_id','')='' or coalesce(btrim(item->>'title'),'')=''
      or source is null or not (source ~ '^https://aquitaine[.]media[.]tourinsoft[.]eu/upload/SIRTAQUI-OD-liste-csv-[a-z-]+[.]csv#[A-Za-z0-9_-]+$' or source ~ '^https://www[.]openstreetmap[.]org/(node|way|relation)/[0-9]+$') then
      raise exception 'Ongeldige categorie, naam of bron.';
    end if;
    select id into cid from public.categories where slug=item->>'category_slug' and active=true;
    if cid is null then raise exception 'Categorie ontbreekt.';end if;
    select id into existing_id from public.events where directory_source_id=item->>'source_id' or source_url=source
      or (is_directory_entry and lower(btrim(title))=lower(btrim(item->>'title')) and lower(btrim(coalesce(city,'')))=lower(btrim(coalesce(item->>'city','')))) limit 1;
    if existing_id is not null then skipped_count:=skipped_count+1;continue;end if;
    insert into public.events(title,slug,short_description,description,start_at,end_at,address,postcode,city,latitude,longitude,website_url,source_url,contact_phone,image_url,status,verified,is_directory_entry,directory_source_id,source_category,is_free)
    values(item->>'title','directory-'||pg_catalog.md5(item->>'source_id'),item->>'short_description',item->>'description',null,null,item->>'address',item->>'postcode',item->>'city',nullif(item->>'latitude','')::numeric,nullif(item->>'longitude','')::numeric,item->>'website_url',source,item->>'contact_phone',item->>'image_url','approved',true,true,item->>'source_id',item->>'category_slug',false)
    returning id into eid;
    insert into public.event_categories(event_id,category_id) values(eid,cid) on conflict do nothing;
    inserted_count:=inserted_count+1;
  end loop;
  perform set_config('cdd.trusted_import','off',true);
  return jsonb_build_object('inserted',inserted_count,'skipped',skipped_count);
end $function$
;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.supplement_source_event_images(jsonb)'::regprocedure) into definition;
 -- Restrict suppression to the image update statement, not user editing.
 if definition is null then raise exception 'Image supplement function missing';end if;
 definition:=regexp_replace(definition,'begin[\r\n]+',E'begin\n  perform set_config(''cdd.trusted_import'',''on'',true);\n','i');
 execute definition;
end $$;
revoke all on function public.import_directory_entries(jsonb) from public,anon,authenticated;
grant execute on function public.import_directory_entries(jsonb) to service_role;
notify pgrst,'reload schema';
commit;

