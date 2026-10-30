begin;
create table public.listing_requests (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
 kind text not null check(kind in ('claim','correction')), name text not null, email text not null,
 organization text not null default '', phone text not null default '', message text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','resolved','revoked')),
 verification_note text, verified_contact text, reviewed_at timestamptz, created_at timestamptz not null default now()
);
create index listing_requests_created_idx on public.listing_requests(created_at desc);
create index listing_requests_event_idx on public.listing_requests(event_id);
create index listing_requests_email_idx on public.listing_requests(lower(email),created_at);
create unique index listing_requests_active_claim on public.listing_requests(event_id) where kind='claim' and status='approved';
alter table public.listing_requests enable row level security;
revoke all on public.listing_requests from public,anon,authenticated;
grant all on public.listing_requests to service_role;
create table public.listing_review_history (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.listing_requests(id) on delete cascade,
 action text not null,note text not null,contact text,reviewer_id uuid,created_at timestamptz not null default now()
);
create index listing_review_history_request_idx on public.listing_review_history(request_id);
alter table public.listing_review_history enable row level security;
revoke all on public.listing_review_history from public,anon,authenticated;
grant all on public.listing_review_history to service_role;
alter table public.event_owner_access add column request_id uuid references public.listing_requests(id);
create index event_owner_access_request_idx on public.event_owner_access(request_id);

create table public.listing_change_history (
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id) on delete cascade,
 request_id uuid references public.listing_requests(id),before_data jsonb not null,after_data jsonb not null,
 created_at timestamptz not null default now()
);
create index listing_change_history_event_idx on public.listing_change_history(event_id,created_at desc);
create index listing_change_history_request_idx on public.listing_change_history(request_id);
alter table public.listing_change_history enable row level security;
revoke all on public.listing_change_history from public,anon,authenticated;
grant all on public.listing_change_history to service_role;

create or replace function public.submit_listing_request(p_request jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare rid uuid; eid uuid:=(p_request->>'event_id')::uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(p_request->>'email'),0));
 if p_request->>'kind' not in ('claim','correction') or length(coalesce(p_request->>'name','')) not between 1 and 150
 or length(coalesce(p_request->>'message','')) not between 1 and 4000 or length(coalesce(p_request->>'email','')) not between 3 and 254
 then raise exception 'Ongeldige aanvraag.';end if;
 if not exists(select 1 from public.events where id=eid and status='approved' and verified) then raise exception 'Deze vermelding is niet beschikbaar voor een aanvraag.';end if;
 if (select count(*) from public.listing_requests where lower(email)=lower(p_request->>'email') and created_at>now()-interval '1 day')>=5
 or exists(select 1 from public.listing_requests where event_id=eid and lower(email)=lower(p_request->>'email') and kind=p_request->>'kind' and status='pending')
 then raise exception 'Er staat al een verzoek open of je hebt vandaag te veel verzoeken verstuurd.';end if;
 insert into public.listing_requests(event_id,kind,name,email,organization,phone,message)
 values(eid,p_request->>'kind',p_request->>'name',p_request->>'email',coalesce(p_request->>'organization',''),coalesce(p_request->>'phone',''),p_request->>'message') returning id into rid;
 return rid;
end $$;
revoke all on function public.submit_listing_request(jsonb) from public,anon,authenticated;
grant execute on function public.submit_listing_request(jsonb) to service_role;

create or replace function public.review_listing_request(p_id uuid,p_action text,p_note text,p_contact text,p_token_hash text,p_reviewer uuid default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare r public.listing_requests%rowtype;
begin
 select * into r from public.listing_requests where id=p_id for update;
 if not found then raise exception 'Aanvraag niet gevonden.';end if;
 perform 1 from public.events where id=r.event_id for update;
 if length(btrim(coalesce(p_note,'')))<15 or length(p_note)>4000 then raise exception 'Leg de controle of beslissing vast (minimaal 15 tekens).';end if;
 if p_action='approved' then
  if r.kind<>'claim' or r.status<>'pending' then raise exception 'Alleen een open beheeraanvraag kan worden goedgekeurd.';end if;
  if length(btrim(coalesce(p_contact,'')))<5 or length(p_contact)>1000 then raise exception 'Vermeld het onafhankelijk gecontroleerde contactadres of telefoonnummer en de officiële bron.';end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Ongeldige beheerlink.';end if;
  if exists(select 1 from public.event_owner_access where event_id=r.event_id) then raise exception 'Deze vermelding heeft al beheerrechten. Trek bestaande rechten eerst gecontroleerd in.';end if;
  insert into public.event_owner_access(event_id,token_hash,request_id)values(r.event_id,p_token_hash,r.id);
 elsif p_action='revoked' then
  if r.status<>'approved' or r.kind<>'claim' then raise exception 'Alleen verleende beheerrechten kunnen worden ingetrokken.';end if;
  delete from public.event_owner_access where request_id=r.id;
 elsif p_action not in ('rejected','resolved') or r.status<>'pending' or (p_action='resolved' and r.kind<>'correction') then
  raise exception 'Ongeldige beslissing.';
 end if;
 insert into public.listing_review_history(request_id,action,note,contact,reviewer_id)values(p_id,p_action,p_note,nullif(p_contact,''),p_reviewer);
 update public.listing_requests set status=p_action,verification_note=p_note,verified_contact=nullif(p_contact,''),reviewed_at=now() where id=p_id;
 return r.event_id;
end $$;
revoke all on function public.review_listing_request(uuid,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.review_listing_request(uuid,text,text,text,text,uuid) to service_role;
create or replace function public.update_managed_event(p_id uuid,p_patch jsonb,p_category_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare existing public.events%rowtype;
begin
 select * into existing from public.events where id=p_id for update;
 if not found or (not existing.is_manual_entry and not exists(select 1 from public.listing_requests where event_id=p_id and kind='claim' and status='approved')) then raise exception 'Deze vermelding kan niet worden gewijzigd.';end if;
 if nullif(btrim(p_patch->>'title'),'') is null then raise exception 'Vul een titel in.';end if;
 if existing.promotion_status='active' and not exists(select 1 from public.event_categories where event_id=p_id and category_id=p_category_id) then raise exception 'Een actieve advertentiecategorie kan niet worden gewijzigd.';end if;
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
 image_url=case when p_patch ? 'image_url' then nullif(p_patch->>'image_url','') else existing.image_url end,updated_at=now()
 where id=p_id;
 delete from public.event_categories where event_id=p_id and category_id is distinct from p_category_id;
 if p_category_id is not null then insert into public.event_categories(event_id,category_id)values(p_id,p_category_id)on conflict do nothing;end if;
end $$;
revoke all on function public.update_managed_event(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.update_managed_event(uuid,jsonb,uuid) to service_role;


notify pgrst,'reload schema';
commit;
