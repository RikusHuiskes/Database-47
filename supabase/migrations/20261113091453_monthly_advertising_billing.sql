begin;
create table public.advertising_contracts (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique references public.advertising_requests(id),
 event_id uuid not null references public.events(id),method text not null check(method in ('sepa','creditcard')),
 status text not null default 'checkout' check(status in ('checkout','active','past_due','cancelled')),
 amount_cents integer not null check(amount_cents>0),anchor_date date not null,paid_until date,
 customer_id text unique,mandate_id text,is_test_mode boolean not null,
 terms_version text not null,consented_at timestamptz not null default now(),cancelled_at timestamptz,
 locale text not null default 'fr' check(locale in ('nl','en','fr')),created_at timestamptz not null default now()
);
create table public.advertising_billing_cycles (
 id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.advertising_contracts(id),
 cycle_index integer not null check(cycle_index>=0),request_id uuid not null unique references public.advertising_requests(id),
 starts_on date not null,ends_on date not null,charge_on date not null,
 payment_id text unique,state text not null default 'planned' check(state in ('planned','creating','open','paid','failed','canceled','expired','refunded','cancelled')),
 checkout_key uuid not null default gen_random_uuid(),attempted_at timestamptz,lease_until timestamptz,
 notice_accepted_at timestamptz,invoice_id uuid references public.advertising_invoices(id),last_error text,
 unique(contract_id,cycle_index),check(ends_on>starts_on)
);
create index advertising_billing_due on public.advertising_billing_cycles(charge_on) where state in ('planned','creating');
create table public.advertising_billing_mail (
 id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.advertising_contracts(id),
 cycle_id uuid references public.advertising_billing_cycles(id),kind text not null check(kind in ('confirmed','upcoming','failed','cancelled')),
 dedupe_key text not null unique,state text not null default 'pending' check(state in ('pending','sending','accepted','failed')),
 attempts integer not null default 0,lease_until timestamptz,accepted_at timestamptz,last_error text,created_at timestamptz not null default now()
);
alter table public.advertising_contracts enable row level security;
alter table public.advertising_billing_cycles enable row level security;
alter table public.advertising_billing_mail enable row level security;
revoke all on public.advertising_contracts,public.advertising_billing_cycles,public.advertising_billing_mail from public,anon,authenticated;
grant all on public.advertising_contracts,public.advertising_billing_cycles,public.advertising_billing_mail to service_role;

-- All RPCs are service-only. The HTTP boundary verifies the personal management token.
create function public.prepare_monthly_contract(p_request_id uuid,p_method text,p_terms text,p_locale text,p_test boolean) returns uuid
language plpgsql security invoker set search_path='' as $$
declare r public.advertising_requests%rowtype;c public.advertising_contracts%rowtype;kind text;cid uuid;
begin
 select * into strict r from public.advertising_requests where id=p_request_id for update;
 if p_method not in ('sepa','creditcard') or p_terms<>'2026-11-13-monthly-v1' or p_locale not in ('nl','en','fr') then raise exception 'Ongeldige abonnementstoestemming.';end if;
 select * into c from public.advertising_contracts where request_id=r.id;
 if found then
  if c.method<>p_method or c.is_test_mode<>p_test or c.status='cancelled' then raise exception 'De betaalkeuze van deze aanvraag kan niet worden gewijzigd.';end if;
  return c.id;
 end if;
 if r.months<>1 or r.payment_status<>'requested' or r.mollie_payment_id is not null then raise exception 'Maak een nieuwe maandelijkse aanvraag.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('monthly-event:'||r.event_id::text,0));
 if exists(select 1 from public.advertising_contracts x join public.advertising_requests a on a.id=x.request_id where x.event_id=r.event_id and x.status<>'cancelled' and (a.details->'placements') ?| array(select jsonb_array_elements_text(r.details->'placements'))) then raise exception 'Deze advertentievorm heeft al een abonnement.';end if;
 for kind in select jsonb_array_elements_text(r.details->'placements') order by 1 loop
  perform public.assert_advertising_capacity(r.event_id,kind,r.starts_on,'9999-12-31');
 end loop;
 update public.advertising_requests set is_test_mode=p_test where id=r.id;
 insert into public.advertising_contracts(request_id,event_id,method,amount_cents,anchor_date,is_test_mode,terms_version,locale)
 values(r.id,r.event_id,p_method,r.amount_cents,r.starts_on,p_test,p_terms,p_locale) returning id into cid;
 insert into public.advertising_billing_cycles(contract_id,cycle_index,request_id,starts_on,ends_on,charge_on,checkout_key)
 values(cid,0,r.id,r.starts_on,r.ends_on,(now() at time zone 'Europe/Paris')::date,r.checkout_key);
 return cid;
end $$;

create function public.reserve_monthly_cycle(p_contract_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.advertising_contracts%rowtype;r public.advertising_requests%rowtype;n integer;starts date;ends date;rid uuid;bid uuid;kind text;
begin
 select * into strict c from public.advertising_contracts where id=p_contract_id for update;
 if c.status<>'active' or c.mandate_id is null then return null;end if;
 select count(*)::integer into n from public.advertising_billing_cycles where contract_id=c.id;
 if exists(select 1 from public.advertising_billing_cycles where contract_id=c.id and state<>'paid') then return null;end if;
 starts:=(c.anchor_date+make_interval(months=>n))::date;ends:=(c.anchor_date+make_interval(months=>n+1))::date;
 select * into strict r from public.advertising_requests where id=c.request_id;
 -- Stop event advertising at the event's end. Directory listings can continue.
 if exists(select 1 from public.events e where e.id=c.event_id and (e.status='rejected' or (not e.is_directory_entry and coalesce(e.end_at,e.start_at)<starts::timestamp at time zone 'Europe/Paris'))) then
  update public.advertising_contracts set status='cancelled',cancelled_at=now() where id=c.id;return null;
 end if;
 for kind in select jsonb_array_elements_text(r.details->'placements') order by 1 loop
  perform public.assert_advertising_capacity(c.event_id,kind,starts,ends);
 end loop;
 insert into public.advertising_requests(event_id,placement,details,starts_on,ends_on,months,amount_cents,is_test_mode)
 values(c.event_id,r.placement,r.details,starts,ends,1,c.amount_cents,c.is_test_mode) returning id into rid;
 insert into public.advertising_billing_cycles(contract_id,cycle_index,request_id,starts_on,ends_on,charge_on)
 values(c.id,n,rid,starts,ends,starts) returning id into bid;
 return bid;
end $$;

create function public.apply_monthly_payment(p_cycle_id uuid,p_payment_id text,p_state text,p_mandate_id text default null) returns void
language plpgsql security invoker set search_path='' as $$
declare b public.advertising_billing_cycles%rowtype;c public.advertising_contracts%rowtype;kind text;
begin
 -- Consistent lock order with cancellation and scheduler.
 select c1.* into strict c from public.advertising_contracts c1 join public.advertising_billing_cycles b1 on b1.contract_id=c1.id where b1.id=p_cycle_id for update of c1;
 select * into strict b from public.advertising_billing_cycles where id=p_cycle_id for update;
 if b.payment_id is not null and b.payment_id<>p_payment_id then raise exception 'Andere betaling voor deze termijn.';end if;
 if p_state not in ('open','paid','failed','canceled','expired','refunded') then raise exception 'Ongeldige betaalstatus.';end if;
 -- Final/paid states must not be downgraded by delayed open callbacks.
 if b.state='refunded' or b.state='paid' and p_state<>'refunded' or b.state in ('failed','canceled','expired') and p_state='open' then return;end if;
 if b.state='cancelled' and b.attempted_at is null then raise exception 'Deze termijn is opgezegd.';end if;
 update public.advertising_requests set mollie_payment_id=p_payment_id where id=b.request_id;
 perform public.settle_advertising_payment(p_payment_id,p_state);
 update public.advertising_billing_cycles set payment_id=p_payment_id,state=p_state,lease_until=null,last_error=null where id=b.id;
 if p_state='paid' then
  update public.advertising_contracts set paid_until=greatest(paid_until,b.ends_on),mandate_id=coalesce(p_mandate_id,mandate_id),status=case when status='cancelled' then status else 'active' end where id=c.id;
  if b.cycle_index=0 then insert into public.advertising_billing_mail(contract_id,cycle_id,kind,dedupe_key) values(c.id,b.id,'confirmed','confirmed:'||c.id) on conflict(dedupe_key) do nothing;end if;
 elsif p_state in ('failed','canceled','expired','refunded') then
  update public.advertising_contracts set status=case when status='cancelled' then status else 'past_due' end where id=c.id;
  insert into public.advertising_billing_mail(contract_id,cycle_id,kind,dedupe_key) values(c.id,b.id,'failed','failed:'||b.id) on conflict(dedupe_key) do nothing;
 end if;
end $$;

create function public.cancel_monthly_contract(p_contract_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare c public.advertising_contracts%rowtype;
begin
 select * into strict c from public.advertising_contracts where id=p_contract_id for update;
 update public.advertising_contracts set status='cancelled',cancelled_at=coalesce(cancelled_at,now()) where id=c.id;
 update public.advertising_requests set payment_status='canceled' where id in(select request_id from public.advertising_billing_cycles where contract_id=c.id and state='planned' and attempted_at is null);
 update public.advertising_billing_cycles set state='cancelled' where contract_id=c.id and state='planned' and attempted_at is null;
 insert into public.advertising_billing_mail(contract_id,kind,dedupe_key) values(c.id,'cancelled','cancelled:'||c.id) on conflict(dedupe_key) do nothing;
end $$;

create function public.claim_monthly_charge(p_cycle_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare c public.advertising_contracts%rowtype;b public.advertising_billing_cycles%rowtype;
begin
 select c1.* into strict c from public.advertising_contracts c1 join public.advertising_billing_cycles b1 on b1.contract_id=c1.id where b1.id=p_cycle_id for update of c1;
 select * into strict b from public.advertising_billing_cycles where id=p_cycle_id for update;
 if c.status<>'active' or b.cycle_index=0 or b.charge_on>(now() at time zone 'Europe/Paris')::date or b.payment_id is not null or b.state not in ('planned','creating') or b.lease_until>now() or b.notice_accepted_at is null then return false;end if;
 -- Never repeat an ambiguous create outside Mollie's idempotency retention window.
 if b.attempted_at<now()-interval '20 hours' then
  update public.advertising_billing_cycles set last_error='Controleer Mollie: onzekere betaalpoging, geen nieuwe afschrijving gestart.' where id=b.id;return false;
 end if;
 update public.advertising_billing_cycles set state='creating',attempted_at=coalesce(attempted_at,now()),lease_until=now()+interval '5 minutes' where id=b.id;
 return true;
end $$;


create function public.claim_monthly_first(p_cycle_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare c public.advertising_contracts%rowtype;b public.advertising_billing_cycles%rowtype;
begin
 select c1.* into strict c from public.advertising_contracts c1 join public.advertising_billing_cycles b1 on b1.contract_id=c1.id where b1.id=p_cycle_id for update of c1;
 select * into strict b from public.advertising_billing_cycles where id=p_cycle_id for update;
 if c.status<>'checkout' or b.cycle_index<>0 or b.payment_id is not null or b.lease_until>now() or b.attempted_at<now()-interval '20 hours' then return false;end if;
 update public.advertising_billing_cycles set state='creating',attempted_at=coalesce(attempted_at,now()),lease_until=now()+interval '5 minutes' where id=b.id;return true;
end $$;

do $$declare f record;begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('prepare_monthly_contract','reserve_monthly_cycle','apply_monthly_payment','cancel_monthly_contract','claim_monthly_charge','claim_monthly_first') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
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

  union all
  select c.event_id,greatest(c.anchor_date::timestamp at time zone 'Europe/Paris',period_start),period_end
  from public.advertising_contracts c join public.advertising_requests r on r.id=c.request_id join public.events e on e.id=c.event_id
  where c.event_id<>p_event_id and not c.is_test_mode and (c.status='active' or c.status='checkout' and c.created_at>now()-interval '1 day')
   and r.details->'placements' ? p_placement
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

  union all
  select c.event_id,greatest(c.anchor_date::timestamp at time zone 'Europe/Paris',period_start),period_end
  from public.advertising_contracts c join public.advertising_requests r on r.id=c.request_id join public.events e on e.id=c.event_id
  where c.event_id<>p_event_id and not c.is_test_mode and (c.status='active' or c.status='checkout' and c.created_at>now()-interval '1 day')
   and r.details->'placements' ? p_placement and e.municipal_key is not null and e.municipal_code=target.municipal_code and (p_placement='homepage' or e.municipal_type=target.municipal_type)
 ), points as (select period_start t union select starts from intervals where starts<ends)
 select coalesce(max(n),0)::integer into occupied from (select count(distinct i.id) n from points p left join intervals i on i.starts<=p.t and p.t<i.ends group by p.t) counts;
 if occupied>=9 then raise exception 'Geen advertentieplek beschikbaar in deze gemeente en rubriek voor de gekozen periode (maximaal 9).';end if;
end $$;
revoke all on function public.assert_advertising_capacity(uuid,text,date,date) from public,anon,authenticated;
grant execute on function public.assert_advertising_capacity(uuid,text,date,date) to service_role;


notify pgrst,'reload schema';
commit;
