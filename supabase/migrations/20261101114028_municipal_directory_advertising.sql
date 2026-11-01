begin;
alter table public.events add column municipal_key text,add column municipal_code text,add column municipal_type text,add column municipal_email text,add column municipal_hours text;
alter table public.events add constraint municipal_listing_scope check ((municipal_key is null and municipal_code is null and municipal_type is null) or (municipal_key is not null and municipal_code ~ '^[0-9]{5}$' and municipal_type is not null and is_directory_entry));
create unique index events_municipal_key_unique on public.events(municipal_key) where municipal_key is not null;
create index events_municipal_scope_idx on public.events(municipal_code,municipal_type) where municipal_key is not null;
drop index if exists public.events_source_url_unique_idx;
create unique index events_source_url_unique_idx on public.events(source_url) where source_url is not null and not is_manual_entry and municipal_key is null;
create function public.register_municipal_listing(p_listing jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare rid uuid; k text:=p_listing->>'key';
begin
 if nullif(k,'') is null or length(k)>250 or coalesce(p_listing->>'code','') !~ '^[0-9]{5}$' or nullif(p_listing->>'title','') is null or nullif(p_listing->>'type','') is null or nullif(p_listing->>'city','') is null or coalesce(p_listing->>'source_url','') !~ '^https?://' then raise exception 'Ongeldige gemeentegidsvermelding.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('municipal-listing:'||k,0));
 select id into rid from public.events where municipal_key=k;
 if found then return rid;end if;
 insert into public.events(title,slug,city,address,website_url,source_url,contact_phone,latitude,longitude,status,verified,is_directory_entry,is_manual_entry,municipal_key,municipal_code,municipal_type,municipal_email,municipal_hours)
 values(p_listing->>'title','municipal-'||md5(k),p_listing->>'city',p_listing->>'address',nullif(p_listing->>'website',''),p_listing->>'source_url',nullif(p_listing->>'phone',''),nullif(p_listing->>'latitude','')::numeric,nullif(p_listing->>'longitude','')::numeric,'approved',true,true,false,k,p_listing->>'code',p_listing->>'type',nullif(p_listing->>'email',''),nullif(p_listing->>'hours','')) returning id into rid;
 return rid;
end $$;
revoke all on function public.register_municipal_listing(jsonb) from public,anon,authenticated;
grant execute on function public.register_municipal_listing(jsonb) to service_role;
create or replace function public.assert_calendar_advertising_capacity(p_event_id uuid,p_placement text,p_starts_on date,p_ends_on date) returns void
language plpgsql security invoker set search_path='' as $$
declare cid uuid; capacity integer; occupied integer; period_start timestamptz:=p_starts_on::timestamp at time zone 'Europe/Paris'; period_end timestamptz:=p_ends_on::timestamp at time zone 'Europe/Paris';
begin
 if p_placement='highlight' then return;end if;
 if p_placement not in ('homepage','category') or period_start>=period_end then raise exception 'Ongeldige advertentieperiode.';end if;
 if p_placement='category' then
  select category_id into cid from public.event_categories where event_id=p_event_id order by category_id limit 1;
  if cid is null then raise exception 'Kies een categorie.';end if;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('advertising-capacity:'||p_placement||':'||coalesce(cid::text,'all'),0));
 select 9-count(*)::integer into capacity from public.events where status='approved' and verified
 and (case when p_placement='homepage' then reserved_homepage else reserved_category_id=cid end);
 if exists(select 1 from public.events where id=p_event_id and (case when p_placement='homepage' then reserved_homepage else reserved_category_id=cid end)) then return;end if;
 -- Evaluate simultaneous occupancy at every interval start. Separate bookings
 -- in different weeks must not incorrectly consume the same concurrent slot.
 with intervals as (
  select e.id,greatest(coalesce(e.promotion_start_at,period_start),period_start) as starts,
   least(coalesce(e.promotion_end_at,period_end),period_end) as ends
  from public.events e where e.municipal_key is null and e.id<>p_event_id and e.promotion_type=p_placement and e.promotion_status='active'
   and not(case when p_placement='homepage' then e.reserved_homepage else coalesce(e.reserved_category_id=cid,false) end)
   and (p_placement='homepage' or exists(select 1 from public.event_categories ec where ec.event_id=e.id and ec.category_id=cid))
  union all
  select r.event_id,greatest(r.starts_on::timestamp at time zone 'Europe/Paris',period_start),least(r.ends_on::timestamp at time zone 'Europe/Paris',period_end)
  from public.advertising_requests r join public.events e on e.id=r.event_id
  where e.municipal_key is null and r.event_id<>p_event_id and (r.placement=p_placement or r.details->'placements' ? p_placement) and r.payment_status in ('open','paid')
   and not(case when p_placement='homepage' then e.reserved_homepage else coalesce(e.reserved_category_id=cid,false) end)
   and (p_placement='homepage' or exists(select 1 from public.event_categories ec where ec.event_id=e.id and ec.category_id=cid))
 ), points as (select period_start as t union select starts from intervals where starts<ends)
 select coalesce(max(n),0)::integer into occupied from (select count(distinct i.id) n from points p left join intervals i on i.starts<=p.t and p.t<i.ends group by p.t) counts;
 if occupied>=capacity then raise exception 'Geen advertentieplek beschikbaar in deze periode. Op deze plaats zijn maximaal % overige betaalde advertenties mogelijk.',capacity;end if;
end $$;
revoke all on function public.assert_calendar_advertising_capacity(uuid,text,date,date) from public,anon,authenticated;
grant execute on function public.assert_calendar_advertising_capacity(uuid,text,date,date) to service_role;



create or replace function public.assert_advertising_capacity(p_event_id uuid,p_placement text,p_starts_on date,p_ends_on date) returns void language plpgsql security invoker set search_path='' as $$
declare target public.events%rowtype; occupied integer; period_start timestamptz:=p_starts_on::timestamp at time zone 'Europe/Paris';period_end timestamptz:=p_ends_on::timestamp at time zone 'Europe/Paris';
begin
 select * into target from public.events where id=p_event_id;
 if target.municipal_key is null then perform public.assert_calendar_advertising_capacity(p_event_id,p_placement,p_starts_on,p_ends_on);return;end if;
 if p_placement='highlight' then return;end if;
 if p_placement not in ('homepage','category') or period_start>=period_end then raise exception 'Ongeldige advertentieperiode.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('municipal-capacity:'||target.municipal_code||':'||p_placement||':'||case when p_placement='category' then target.municipal_type else 'all' end,0));
 with intervals as (
 select r.event_id as id,greatest(r.starts_on::timestamp at time zone 'Europe/Paris',period_start) as starts,least(r.ends_on::timestamp at time zone 'Europe/Paris',period_end) as ends
 from public.advertising_requests r join public.events e on e.id=r.event_id
 where r.event_id<>p_event_id and e.municipal_key is not null and e.municipal_code=target.municipal_code and (p_placement='homepage' or e.municipal_type=target.municipal_type) and r.payment_status in ('open','paid') and (r.placement=p_placement or r.details->'placements' ? p_placement)
 ), points as (select period_start as t union select starts from intervals where starts<ends)
 select coalesce(max(n),0)::integer into occupied from (select count(distinct i.id) n from points p left join intervals i on i.starts<=p.t and p.t<i.ends group by p.t) counts;
 if occupied>=9 then raise exception 'Geen advertentieplek beschikbaar in deze gemeente en rubriek voor de gekozen periode (maximaal 9).';end if;
end $$;
revoke all on function public.assert_advertising_capacity(uuid,text,date,date) from public,anon,authenticated;
grant execute on function public.assert_advertising_capacity(uuid,text,date,date) to service_role;
create or replace function public.request_managed_advertising_selection(p_event_id uuid,p_token_hash text,p_ad jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare e public.events%rowtype; kinds jsonb:=p_ad->'details'->'placements'; kind text; price integer; rid uuid;
 starts date:=(p_ad->>'startDate')::date; ends date:=(p_ad->>'endDate')::date; duration integer:=(p_ad->>'months')::integer;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or not exists(select 1 from public.event_owner_access where event_id=p_event_id and token_hash=p_token_hash) then raise exception 'Ongeldige beheerlink.';end if;
 if jsonb_typeof(kinds) is distinct from 'array' then raise exception 'Kies een of meer geldige advertentievormen.';end if;
 if jsonb_array_length(kinds) not between 1 and 3 or exists(select 1 from jsonb_array_elements_text(kinds) k where k not in ('highlight','category','homepage')) or (select count(distinct k) from jsonb_array_elements_text(kinds) k)<>jsonb_array_length(kinds) then raise exception 'Kies een of meer geldige advertentievormen.';end if;
 select jsonb_agg(k order by k) into kinds from jsonb_array_elements_text(kinds) k;
 p_ad:=jsonb_set(p_ad,'{details,placements}',kinds);
 select sum(case k when 'highlight' then 1500 when 'category' then 7900 when 'homepage' then 14900 end)::integer into price from jsonb_array_elements_text(kinds) k;
 if duration is null or duration not between 1 and 12 or starts is null or ends is null or starts<(now() at time zone 'Europe/Paris')::date or ends<>(starts+make_interval(months=>duration))::date or (p_ad->>'amountCents')::integer is distinct from price*duration then raise exception 'Ongeldige advertentieaanvraag of periode.';end if;
 if e.status='rejected' or (not e.is_directory_entry and coalesce(e.end_at,e.start_at)<now()) then raise exception 'Deze vermelding kan nu niet worden geadverteerd. Controleer de status en datum.';end if;
 if e.municipal_key is null and kinds ? 'category' and not exists(select 1 from public.event_categories where event_id=p_event_id) then raise exception 'Sla eerst een categorie op bij je vermelding.';end if;
 select id into rid from public.advertising_requests where event_id=p_event_id and payment_status in ('requested','open','paid') and ends_on>(now() at time zone 'Europe/Paris')::date and starts_on=starts and ends_on=ends and details=p_ad->'details' order by created_at desc limit 1;
 if found then return rid;end if;
 if exists(select 1 from public.advertising_requests r cross join lateral jsonb_array_elements_text(coalesce(r.details->'placements',jsonb_build_array(r.placement))) k where r.event_id=p_event_id and r.payment_status in ('requested','open','paid') and r.ends_on>(now() at time zone 'Europe/Paris')::date and kinds ? k) then raise exception 'Een gekozen advertentievorm is al betaald of aangevraagd. Kies alleen de extra vormen.';end if;
 for kind in select jsonb_array_elements_text(kinds) order by 1 loop
  perform public.assert_advertising_capacity(p_event_id,kind,starts,ends);
 end loop;
 insert into public.advertising_requests(event_id,placement,details,starts_on,ends_on,months,amount_cents) values(p_event_id,kinds->>0,p_ad->'details',starts,ends,duration,price*duration) returning id into rid;
 update public.events set promotion_type=kinds->>0,promotion_status='requested',promotion_start_at=starts::timestamp at time zone 'Europe/Paris',promotion_end_at=ends::timestamp at time zone 'Europe/Paris',updated_at=now() where id=p_event_id and promotion_status<>'active';
 return rid;
end $$;
revoke all on function public.request_managed_advertising_selection(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.request_managed_advertising_selection(uuid,text,jsonb) to service_role;

create or replace function public.update_managed_event(p_id uuid,p_patch jsonb,p_category_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare existing public.events%rowtype;
begin
 select * into existing from public.events where id=p_id for update;
 if not found or (not existing.is_manual_entry and not exists(select 1 from public.listing_requests where event_id=p_id and kind='claim' and status='approved')) then raise exception 'Deze vermelding kan niet worden gewijzigd.';end if;
 if nullif(btrim(p_patch->>'title'),'') is null then raise exception 'Vul een titel in.';end if;
 if existing.municipal_key is not null and p_patch->>'city' is distinct from existing.city then raise exception 'Neem contact op met de beheerder om de vestigingsgemeente te wijzigen.';end if;
 if existing.municipal_key is null and existing.promotion_status='active' and not exists(select 1 from public.event_categories where event_id=p_id and category_id=p_category_id) then raise exception 'Een actieve advertentiecategorie kan niet worden gewijzigd.';end if;
 insert into public.listing_change_history(event_id,request_id,before_data,after_data) values(p_id,(select id from public.listing_requests where event_id=p_id and kind='claim' and status='approved'),to_jsonb(existing),p_patch||jsonb_build_object('category_id',p_category_id));
 update public.events set
 title=p_patch->>'title',short_description=nullif(p_patch->>'short_description',''),description=nullif(p_patch->>'description',''),
 venue_name=nullif(p_patch->>'venue_name',''),address=nullif(p_patch->>'address',''),postcode=nullif(p_patch->>'postcode',''),city=nullif(p_patch->>'city',''),
 latitude=case when coalesce(p_patch->>'city','')<>coalesce(existing.city,'') or coalesce(p_patch->>'address','')<>coalesce(existing.address,'') then null else existing.latitude end,
 longitude=case when coalesce(p_patch->>'city','')<>coalesce(existing.city,'') or coalesce(p_patch->>'address','')<>coalesce(existing.address,'') then null else existing.longitude end,
 start_at=case when existing.is_directory_entry then null else (p_patch->>'start_at')::timestamptz end,
 end_at=case when existing.is_directory_entry then null else nullif(p_patch->>'end_at','')::timestamptz end,
 website_url=p_patch->>'website_url',booking_url=p_patch->>'booking_url',source_url=case when existing.is_manual_entry then p_patch->>'source_url' else existing.source_url end,contact_phone=nullif(p_patch->>'contact_phone',''),
 price_from=nullif(p_patch->>'price_from','')::numeric,price_to=nullif(p_patch->>'price_to','')::numeric,is_free=coalesce((p_patch->>'is_free')::boolean,false),
 municipal_email=case when existing.municipal_key is not null then nullif(p_patch->>'municipal_email','') else existing.municipal_email end,municipal_hours=case when existing.municipal_key is not null then nullif(p_patch->>'municipal_hours','') else existing.municipal_hours end,
 image_url=case when p_patch ? 'image_url' then nullif(p_patch->>'image_url','') else existing.image_url end,updated_at=now()
 where id=p_id;
 if existing.municipal_key is null then
 delete from public.event_categories where event_id=p_id and category_id is distinct from p_category_id;
 if p_category_id is not null then insert into public.event_categories(event_id,category_id)values(p_id,p_category_id)on conflict do nothing;end if;
 end if;
end $$;

notify pgrst,'reload schema';
commit;
