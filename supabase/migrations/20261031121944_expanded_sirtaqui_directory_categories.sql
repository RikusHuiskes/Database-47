begin;
create or replace function public.import_directory_entries(p_entries jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; cid uuid; eid uuid; existing_id uuid; inserted_count integer:=0; skipped_count integer:=0; source text;
begin
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
    values(item->>'title','directory-'||pg_catalog.md5(item->>'source_id'),item->>'short_description',item->>'description',null,null,item->>'address',item->>'postcode',item->>'city',nullif(item->>'latitude','')::numeric,nullif(item->>'longitude','')::numeric,item->>'website_url',source,item->>'contact_phone',item->>'image_url','pending',false,true,item->>'source_id',item->>'category_slug',false)
    returning id into eid;
    insert into public.event_categories(event_id,category_id) values(eid,cid) on conflict do nothing;
    inserted_count:=inserted_count+1;
  end loop;
  return jsonb_build_object('inserted',inserted_count,'skipped',skipped_count);
end $$;
revoke all on function public.import_directory_entries(jsonb) from public,anon,authenticated;
grant execute on function public.import_directory_entries(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
