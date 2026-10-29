begin;
alter table public.events add column if not exists promotion_start_at timestamptz, add column if not exists promotion_end_at timestamptz;
create table public.event_owner_access(
 event_id uuid not null references public.events(id) on delete cascade,
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now()
);
create index event_owner_access_event_idx on public.event_owner_access(event_id);
alter table public.event_owner_access enable row level security;
revoke all on public.event_owner_access from public,anon,authenticated;
grant all on public.event_owner_access to service_role;
create table public.advertising_requests(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id) on delete cascade,
 placement text not null check(placement in ('homepage','category','highlight')),
 details jsonb not null,starts_on date not null,ends_on date not null,months integer not null check(months between 1 and 12),
 amount_cents integer not null check(amount_cents>0),currency text not null default 'EUR' check(currency='EUR'),
 payment_status text not null default 'requested' check(payment_status in ('requested','open','paid','failed','canceled','expired','refunded')),
 mollie_payment_id text unique,checkout_key uuid not null default gen_random_uuid(),created_at timestamptz not null default now(),
 check(ends_on>starts_on)
);
create index advertising_requests_event_idx on public.advertising_requests(event_id,created_at desc);
alter table public.advertising_requests enable row level security;
revoke all on public.advertising_requests from public,anon,authenticated;
grant all on public.advertising_requests to service_role;

create or replace function public.submit_managed_event(p_event jsonb,p_category_id uuid,p_token_hash text,p_ad jsonb default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid;prefix text:='managed-'||gen_random_uuid()::text;placement text:=coalesce(p_event->>'promotion_type','none');expected integer;
begin
 if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Ongeldige beheerlink.';end if;
 if placement='category' and p_category_id is null then raise exception 'Kies een categorie.';end if;
 perform public.submit_pending_event(p_event||jsonb_build_object('slug',prefix,'submission_kind','manual','advertiser_email',null,'start_at',case when coalesce((p_event->>'is_directory_entry')::boolean,false) then now()::text else p_event->>'start_at' end),p_category_id);
 select id into strict eid from public.events where slug like prefix||'-%';
 if coalesce((p_event->>'is_directory_entry')::boolean,false) then update public.events set is_directory_entry=true,start_at=null,end_at=null where id=eid;end if;
 insert into public.event_owner_access(event_id,token_hash)values(eid,p_token_hash);
 if placement<>'none' then
  expected:=case placement when 'homepage' then 14900 when 'category' then 7900 when 'highlight' then 1500 else 0 end;
  if p_ad is null or (p_ad->>'amountCents')::integer<>expected*(p_ad->>'months')::integer then raise exception 'Ongeldige advertentieaanvraag.';end if;
  insert into public.advertising_requests(event_id,placement,details,starts_on,ends_on,months,amount_cents)
   values(eid,placement,p_ad->'details',(p_ad->>'startDate')::date,(p_ad->>'endDate')::date,(p_ad->>'months')::integer,(p_ad->>'amountCents')::integer);
  update public.events set promotion_start_at=(p_ad->>'startDate')::date::timestamp at time zone 'Europe/Paris',promotion_end_at=(p_ad->>'endDate')::date::timestamp at time zone 'Europe/Paris' where id=eid;
 end if;
 return eid;
end $$;
revoke all on function public.submit_managed_event(jsonb,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_managed_event(jsonb,uuid,text,jsonb) to service_role;

create or replace function public.update_managed_event(p_id uuid,p_patch jsonb,p_category_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare existing public.events%rowtype;
begin
 select * into existing from public.events where id=p_id for update;
 if not found or not existing.is_manual_entry then raise exception 'Deze vermelding kan niet worden gewijzigd.';end if;
 if nullif(btrim(p_patch->>'title'),'') is null then raise exception 'Vul een titel in.';end if;
 if existing.promotion_status='active' and not exists(select 1 from public.event_categories where event_id=p_id and category_id=p_category_id) then raise exception 'Een actieve advertentiecategorie kan niet worden gewijzigd.';end if;
 update public.events set
 title=p_patch->>'title',short_description=nullif(p_patch->>'short_description',''),description=nullif(p_patch->>'description',''),
 venue_name=nullif(p_patch->>'venue_name',''),address=nullif(p_patch->>'address',''),postcode=nullif(p_patch->>'postcode',''),city=nullif(p_patch->>'city',''),
 latitude=case when coalesce(p_patch->>'city','')<>coalesce(existing.city,'') or coalesce(p_patch->>'address','')<>coalesce(existing.address,'') then null else existing.latitude end,
 longitude=case when coalesce(p_patch->>'city','')<>coalesce(existing.city,'') or coalesce(p_patch->>'address','')<>coalesce(existing.address,'') then null else existing.longitude end,
 start_at=case when existing.is_directory_entry then null else (p_patch->>'start_at')::timestamptz end,
 end_at=case when existing.is_directory_entry then null else nullif(p_patch->>'end_at','')::timestamptz end,
 website_url=p_patch->>'website_url',booking_url=p_patch->>'booking_url',source_url=p_patch->>'source_url',contact_phone=nullif(p_patch->>'contact_phone',''),
 price_from=nullif(p_patch->>'price_from','')::numeric,price_to=nullif(p_patch->>'price_to','')::numeric,is_free=coalesce((p_patch->>'is_free')::boolean,false),
 image_url=case when p_patch ? 'image_url' then nullif(p_patch->>'image_url','') else existing.image_url end,updated_at=now()
 where id=p_id;
 delete from public.event_categories where event_id=p_id and category_id is distinct from p_category_id;
 if p_category_id is not null then insert into public.event_categories(event_id,category_id)values(p_id,p_category_id)on conflict do nothing;end if;
end $$;
revoke all on function public.update_managed_event(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.update_managed_event(uuid,jsonb,uuid) to service_role;

create or replace function public.activate_paid_advertising() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' and new.verified and new.promotion_status='requested' and exists(select 1 from public.advertising_requests where event_id=new.id and payment_status='paid') then new.promotion_status:='active';end if;
 return new;
end $$;
revoke all on function public.activate_paid_advertising() from public,anon,authenticated;
create trigger activate_paid_advertising before update on public.events for each row execute function public.activate_paid_advertising();
create or replace function public.settle_advertising_payment(p_payment_id text,p_state text) returns void language plpgsql security definer set search_path='' as $body$
declare request public.advertising_requests%rowtype;
begin
 if p_state not in ('open','paid','failed','canceled','expired','refunded') then raise exception 'Ongeldige betaalstatus.';end if;
 select * into strict request from public.advertising_requests where mollie_payment_id=p_payment_id for update;
 update public.advertising_requests set payment_status=p_state where id=request.id;
 if p_state='paid' then
  update public.events set promotion_type=request.placement,promotion_status=case when status='approved' and verified then 'active' else 'requested' end,
   promotion_start_at=request.starts_on::timestamp at time zone 'Europe/Paris',promotion_end_at=request.ends_on::timestamp at time zone 'Europe/Paris'
   where id=request.event_id and promotion_status<>'ended';
 elsif p_state='refunded' then update public.events set promotion_status='ended' where id=request.event_id;end if;
end $body$;
revoke all on function public.settle_advertising_payment(text,text) from public,anon,authenticated;
grant execute on function public.settle_advertising_payment(text,text) to service_role;

-- Only reclassify imported tastings explicitly mentioning wine; do not
-- redirect cheese/chocolate tastings or manually classified records.
create temporary table wine_reclassification on commit drop as
select e.id from public.events e
where not e.is_manual_entry
 and e.source_url like 'https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-agenda-%'
 and translate(lower(concat_ws(' ',e.title,e.description,e.short_description,e.source_category)),'éèêëàâîïôöùûüç','eeeeaaiioouuuc') like '%degustation%'
 and translate(lower(concat_ws(' ',e.title,e.description,e.short_description,e.source_category)),'éèêëàâîïôöùûüç','eeeeaaiioouuuc') ~ '\m(vins?|vignobles?|vignes?|chais?|cepages?|oenolog[a-z]*)\M'
 and exists(select 1 from public.event_categories ec join public.categories c on c.id=ec.category_id where ec.event_id=e.id and c.slug='restaurants-gastronomie');
insert into public.event_categories(event_id,category_id)
 select w.id,c.id from wine_reclassification w cross join public.categories c where c.slug='wijnhuizen' on conflict do nothing;
delete from public.event_categories ec using wine_reclassification w,public.categories c
 where ec.event_id=w.id and ec.category_id=c.id and c.slug='restaurants-gastronomie';

notify pgrst,'reload schema';
commit;
