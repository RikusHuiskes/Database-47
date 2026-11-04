begin;

alter table public.advertising_requests
  add column is_test_mode boolean not null default false;

create table public.advertising_invoice_settings (
  id integer primary key default 1 check (id=1),
  tax_mode text not null check (tax_mode in ('standard','franchise_exempt')),
  vat_rate numeric(5,2) not null check (vat_rate between 0 and 25),
  vat_number text,
  tax_note text not null,
  price_basis text not null check (price_basis='tax_inclusive'),
  updated_at timestamptz not null default now(),
  check ((tax_mode='standard' and vat_rate>0 and nullif(btrim(vat_number),'') is not null)
      or (tax_mode='franchise_exempt' and vat_rate=0 and nullif(btrim(tax_note),'') is not null))
);
alter table public.advertising_invoice_settings enable row level security;
revoke all on public.advertising_invoice_settings from public,anon,authenticated;
grant all on public.advertising_invoice_settings to service_role;

-- A transactional counter (rather than nextval) keeps successfully issued
-- invoice numbers consecutive even when a transaction rolls back.
create table public.advertising_invoice_numbering (
  id integer primary key default 1 check (id=1),
  last_number bigint not null default 0 check (last_number>=0)
);
insert into public.advertising_invoice_numbering(id,last_number) values(1,0);
alter table public.advertising_invoice_numbering enable row level security;
revoke all on public.advertising_invoice_numbering from public,anon,authenticated;
grant all on public.advertising_invoice_numbering to service_role;

create table public.advertising_invoices (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.advertising_requests(id) on delete restrict,
  invoice_number text not null unique,
  issued_at timestamptz not null default now(),
  is_test_mode boolean not null default false,
  currency text not null default 'EUR' check(currency='EUR'),
  net_cents integer not null check(net_cents>=0),
  vat_cents integer not null check(vat_cents>=0),
  total_cents integer not null check(total_cents>0),
  state text not null default 'issued' check(state in ('issued','cancelled')),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  check(net_cents+vat_cents=total_cents)
);
create index advertising_invoices_issued_at_idx on public.advertising_invoices(issued_at desc);
alter table public.advertising_invoices enable row level security;
revoke all on public.advertising_invoices from public,anon,authenticated;
grant all on public.advertising_invoices to service_role;

create table public.advertising_invoice_mail_outbox (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.advertising_invoices(id) on delete restrict,
  recipient text not null,
  state text not null default 'pending' check(state in ('pending','sending','accepted','failed')),
  attempts integer not null default 0 check(attempts>=0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  claimed_at timestamptz,
  accepted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index advertising_invoice_mail_pending_idx on public.advertising_invoice_mail_outbox(next_attempt_at) where state in ('pending','sending');
alter table public.advertising_invoice_mail_outbox enable row level security;
revoke all on public.advertising_invoice_mail_outbox from public,anon,authenticated;
grant all on public.advertising_invoice_mail_outbox to service_role;

create or replace function public.issue_advertising_invoice(p_request_id uuid,p_profile jsonb,p_test_mode boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.advertising_requests%rowtype; seller jsonb; buyer jsonb; invoice_id uuid; invoice_no text;
        sequence_no bigint; tax_mode text; rate numeric; gross integer; net integer; vat integer;
        listing_title text; placement_text text; description text; issued timestamptz:=now();
begin
  if jsonb_typeof(p_profile) is distinct from 'object'
    or jsonb_typeof(p_profile->'seller') is distinct from 'object'
    or nullif(btrim(p_profile->>'taxMode'),'') not in ('standard','franchise_exempt')
    or p_profile->>'priceBasis' is distinct from 'tax_inclusive'
    or nullif(btrim(p_profile->>'taxNote'),'') is null
    or nullif(btrim(p_profile->'seller'->>'name'),'') is null
    or nullif(btrim(p_profile->'seller'->>'address'),'') is null
    or nullif(btrim(p_profile->'seller'->>'postcode'),'') is null
    or nullif(btrim(p_profile->'seller'->>'city'),'') is null
    or nullif(btrim(p_profile->'seller'->>'siret'),'') is null then
    raise exception 'Factuurinstellingen zijn niet volledig.';
  end if;
  tax_mode:=p_profile->>'taxMode';
  rate:=nullif(p_profile->>'vatRate','')::numeric;
  if tax_mode='standard' and (rate is null or rate<=0 or rate>25 or nullif(btrim(p_profile->>'vatNumber'),'') is null) then
    raise exception 'Controleer het btw-nummer en btw-tarief.';
  elsif tax_mode='franchise_exempt' and coalesce(rate,0)<>0 then
    raise exception 'Een vrijgestelde factuur moet een btw-tarief van nul hebben.';
  end if;
  select * into r from public.advertising_requests where id=p_request_id for update;
  if not found then raise exception 'Advertentieaanvraag niet gevonden.'; end if;
  if exists(select 1 from public.advertising_invoices where request_id=r.id) then raise exception 'Voor deze aanvraag bestaat al een factuur.'; end if;
  buyer:=r.details;
  if nullif(btrim(buyer->>'email'),'') is null then raise exception 'De aanvraag heeft geen factuur-e-mailadres.'; end if;
  gross:=r.amount_cents;
  if tax_mode='standard' then
    vat:=round(gross*rate/(100+rate))::integer;
    net:=gross-vat;
  else
    vat:=0;
    net:=gross;
  end if;
  select e.title into listing_title from public.events e where e.id=r.event_id;
  select string_agg(case kind when 'homepage' then 'homepageadvertentie' when 'category' then 'categorieadvertentie' else 'vetomrande vermelding' end,' + ' order by kind)
    into placement_text
    from jsonb_array_elements_text(coalesce(r.details->'placements',jsonb_build_array(r.placement))) as placements(kind);
  description:=concat_ws(' — ',coalesce(listing_title,'Advertentievermelding'),nullif(placement_text,''))
    ||format(' · %s t/m %s',to_char(r.starts_on,'DD-MM-YYYY'),to_char(r.ends_on,'DD-MM-YYYY'));
  seller:=p_profile->'seller';
  if coalesce(p_test_mode,false) then
    update public.advertising_requests set is_test_mode=true where id=r.id;
    invoice_no:='TEST-'||to_char(issued at time zone 'Europe/Paris','YYYY')||'-'||upper(substr(replace(r.id::text,'-',''),1,8));
  else
    if r.is_test_mode then raise exception 'Een testaanvraag kan geen officiële factuur krijgen.'; end if;
    update public.advertising_invoice_numbering set last_number=last_number+1 where id=1 returning last_number into sequence_no;
    if sequence_no is null then raise exception 'Factuurnummering ontbreekt.'; end if;
    invoice_no:='CDD-'||to_char(issued at time zone 'Europe/Paris','YYYY')||'-'||lpad(sequence_no::text,6,'0');
  end if;
  insert into public.advertising_invoices(request_id,invoice_number,issued_at,is_test_mode,net_cents,vat_cents,total_cents,snapshot)
    values(r.id,invoice_no,issued,coalesce(p_test_mode,false),net,vat,gross,
      jsonb_build_object(
        'invoiceNumber',invoice_no,'issuedAt',issued,'currency',r.currency,
        'seller',seller,'customer',buyer,'lineDescription',description,'startsOn',r.starts_on,'endsOn',r.ends_on,
        'netCents',net,'vatCents',vat,'totalCents',gross,'vatRate',rate,'taxMode',tax_mode,
        'taxNote',p_profile->>'taxNote'
      )) returning id into invoice_id;
  insert into public.advertising_invoice_mail_outbox(invoice_id,recipient) values(invoice_id,buyer->>'email');
  return invoice_id;
end $$;
revoke all on function public.issue_advertising_invoice(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.issue_advertising_invoice(uuid,jsonb,boolean) to service_role;

create or replace function public.advertising_invoice_summary()
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'invoiceCount',(select count(*) from public.advertising_invoices where not is_test_mode and state='issued'),
    'invoicedTotalCents',(select coalesce(sum(total_cents),0) from public.advertising_invoices where not is_test_mode and state='issued'),
    'unbilledRequestCount',(select count(*) from public.advertising_requests r where not is_test_mode and not exists(select 1 from public.advertising_invoices i where i.request_id=r.id)),
    'testCount',(select count(*) from public.advertising_requests where is_test_mode),
    'mailPending',(select count(*) from public.advertising_invoice_mail_outbox where state in ('pending','sending')),
    'mailFailed',(select count(*) from public.advertising_invoice_mail_outbox where state='failed')
  )
$$;
revoke all on function public.advertising_invoice_summary() from public,anon,authenticated;
grant execute on function public.advertising_invoice_summary() to service_role;

create or replace function public.claim_advertising_invoice_mail(p_limit integer default 3)
returns setof public.advertising_invoice_mail_outbox language plpgsql security definer set search_path='' as $$
begin
  update public.advertising_invoice_mail_outbox set state='failed',lease_token=null,last_error='Verzending niet afgerond na vijf pogingen.'
    where state='sending' and attempts>=5 and claimed_at<now()-interval '10 minutes';
  return query update public.advertising_invoice_mail_outbox m
    set state='sending',attempts=m.attempts+1,lease_token=gen_random_uuid(),claimed_at=now()
    where m.id in (
      select id from public.advertising_invoice_mail_outbox
      where state in ('pending','failed') and attempts<5 and next_attempt_at<=now()
      order by created_at for update skip locked limit least(10,greatest(1,coalesce(p_limit,3)))
    ) returning m.*;
end $$;
revoke all on function public.claim_advertising_invoice_mail(integer) from public,anon,authenticated;
grant execute on function public.claim_advertising_invoice_mail(integer) to service_role;

create or replace function public.delete_test_advertising_request(p_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.advertising_requests%rowtype;
begin
  select * into r from public.advertising_requests where id=p_request_id for update;
  if not found or not r.is_test_mode then raise exception 'Alleen als test gemarkeerde aanvragen kunnen worden verwijderd.'; end if;
  if exists(select 1 from public.advertising_invoices where request_id=r.id and not is_test_mode) then raise exception 'Een echte uitgegeven factuur kan niet als test worden verwijderd.'; end if;
  delete from public.advertising_invoice_mail_outbox where invoice_id in (select id from public.advertising_invoices where request_id=r.id and is_test_mode);
  delete from public.advertising_invoices where request_id=r.id and is_test_mode;
  delete from public.advertising_requests where id=r.id;
end $$;
revoke all on function public.delete_test_advertising_request(uuid) from public,anon,authenticated;
grant execute on function public.delete_test_advertising_request(uuid) to service_role;

-- Keep preview/test purchases out of real placement capacity and public cards.
create or replace function public.assert_calendar_advertising_capacity(p_event_id uuid,p_placement text,p_starts_on date,p_ends_on date) returns void
language plpgsql security invoker set search_path='' as $$
declare cid uuid; capacity integer; occupied integer; period_start timestamptz:=p_starts_on::timestamp at time zone 'Europe/Paris'; period_end timestamptz:=p_ends_on::timestamp at time zone 'Europe/Paris';
begin
 if p_placement='highlight' then return; end if;
 if p_placement not in ('homepage','category') or period_start>=period_end then raise exception 'Ongeldige advertentieperiode.'; end if;
 if p_placement='category' then
  select category_id into cid from public.event_categories where event_id=p_event_id order by category_id limit 1;
  if cid is null then raise exception 'Kies een categorie.'; end if;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('advertising-capacity:'||p_placement||':'||coalesce(cid::text,'all'),0));
 select 9-count(*)::integer into capacity from public.events where status='approved' and verified and (case when p_placement='homepage' then reserved_homepage else reserved_category_id=cid end);
 if exists(select 1 from public.events where id=p_event_id and (case when p_placement='homepage' then reserved_homepage else reserved_category_id=cid end)) then return; end if;
 with intervals as (
  select e.id,greatest(coalesce(e.promotion_start_at,period_start),period_start) starts,least(coalesce(e.promotion_end_at,period_end),period_end) ends
  from public.events e where e.id<>p_event_id and e.promotion_type=p_placement and e.promotion_status='active'
   and not(case when p_placement='homepage' then e.reserved_homepage else coalesce(e.reserved_category_id=cid,false) end)
   and (p_placement='homepage' or exists(select 1 from public.event_categories ec where ec.event_id=e.id and ec.category_id=cid))
  union all
  select r.event_id,greatest(r.starts_on::timestamp at time zone 'Europe/Paris',period_start),least(r.ends_on::timestamp at time zone 'Europe/Paris',period_end)
  from public.advertising_requests r join public.events e on e.id=r.event_id
  where r.event_id<>p_event_id and not r.is_test_mode and (r.placement=p_placement or r.details->'placements' ? p_placement) and r.payment_status in ('open','paid')
   and not(case when p_placement='homepage' then e.reserved_homepage else coalesce(e.reserved_category_id=cid,false) end)
   and (p_placement='homepage' or exists(select 1 from public.event_categories ec where ec.event_id=e.id and ec.category_id=cid))
 ), points as (select period_start t union select starts from intervals where starts<ends)
 select coalesce(max(n),0)::integer into occupied from (select count(distinct i.id) n from points p left join intervals i on i.starts<=p.t and p.t<i.ends group by p.t) counts;
 if occupied>=capacity then raise exception 'Geen advertentieplek beschikbaar in deze periode. Op deze plaats zijn maximaal % overige betaalde advertenties mogelijk.',capacity; end if;
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
  select r.event_id id,greatest(r.starts_on::timestamp at time zone 'Europe/Paris',period_start) starts,least(r.ends_on::timestamp at time zone 'Europe/Paris',period_end) ends
  from public.advertising_requests r join public.events e on e.id=r.event_id
  where r.event_id<>p_event_id and not r.is_test_mode and e.municipal_key is not null and e.municipal_code=target.municipal_code and (p_placement='homepage' or e.municipal_type=target.municipal_type) and r.payment_status in ('open','paid') and (r.placement=p_placement or r.details->'placements' ? p_placement)
 ), points as (select period_start t union select starts from intervals where starts<ends)
 select coalesce(max(n),0)::integer into occupied from (select count(distinct i.id) n from points p left join intervals i on i.starts<=p.t and p.t<i.ends group by p.t) counts;
 if occupied>=9 then raise exception 'Geen advertentieplek beschikbaar in deze gemeente en rubriek voor de gekozen periode (maximaal 9).';end if;
end $$;
revoke all on function public.assert_advertising_capacity(uuid,text,date,date) from public,anon,authenticated;
grant execute on function public.assert_advertising_capacity(uuid,text,date,date) to service_role;

create or replace function public.sync_event_advertising_placements() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.events set advertising_placements=(select coalesce(jsonb_agg(jsonb_build_object('placement',kind,'starts_at',r.starts_on::timestamp at time zone 'Europe/Paris','ends_at',r.ends_on::timestamp at time zone 'Europe/Paris') order by r.created_at,kind),'[]'::jsonb)
  from public.advertising_requests r cross join lateral jsonb_array_elements_text(coalesce(r.details->'placements',jsonb_build_array(r.placement))) as kind
  where r.event_id=new.event_id and r.payment_status='paid' and not r.is_test_mode) where id=new.event_id;
 return new;
end $$;
revoke all on function public.sync_event_advertising_placements() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
