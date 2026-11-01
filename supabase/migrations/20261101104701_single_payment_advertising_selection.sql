begin;
create or replace function public.assert_advertising_capacity(p_event_id uuid,p_placement text,p_starts_on date,p_ends_on date) returns void
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
  from public.events e where e.id<>p_event_id and e.promotion_type=p_placement and e.promotion_status='active'
   and not(case when p_placement='homepage' then e.reserved_homepage else coalesce(e.reserved_category_id=cid,false) end)
   and (p_placement='homepage' or exists(select 1 from public.event_categories ec where ec.event_id=e.id and ec.category_id=cid))
  union all
  select r.event_id,greatest(r.starts_on::timestamp at time zone 'Europe/Paris',period_start),least(r.ends_on::timestamp at time zone 'Europe/Paris',period_end)
  from public.advertising_requests r join public.events e on e.id=r.event_id
  where r.event_id<>p_event_id and (r.placement=p_placement or r.details->'placements' ? p_placement) and r.payment_status in ('open','paid')
   and not(case when p_placement='homepage' then e.reserved_homepage else coalesce(e.reserved_category_id=cid,false) end)
   and (p_placement='homepage' or exists(select 1 from public.event_categories ec where ec.event_id=e.id and ec.category_id=cid))
 ), points as (select period_start as t union select starts from intervals where starts<ends)
 select coalesce(max(n),0)::integer into occupied from (select count(distinct i.id) n from points p left join intervals i on i.starts<=p.t and p.t<i.ends group by p.t) counts;
 if occupied>=capacity then raise exception 'Geen advertentieplek beschikbaar in deze periode. Op deze plaats zijn maximaal % overige betaalde advertenties mogelijk.',capacity;end if;
end $$;
revoke all on function public.assert_advertising_capacity(uuid,text,date,date) from public,anon,authenticated;
grant execute on function public.assert_advertising_capacity(uuid,text,date,date) to service_role;


create or replace function public.enforce_advertising_capacity() returns trigger
language plpgsql security invoker set search_path='' as $$
declare kind text;
begin
 if new.payment_status in ('open','paid') then
  for kind in select jsonb_array_elements_text(coalesce(new.details->'placements',jsonb_build_array(new.placement))) order by 1 loop
   perform public.assert_advertising_capacity(new.event_id,kind,new.starts_on,new.ends_on);
  end loop;
 end if;
 return new;
end $$;
create or replace function public.sync_event_advertising_placements() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.events set advertising_placements=(select coalesce(jsonb_agg(jsonb_build_object('placement',kind,'starts_at',r.starts_on::timestamp at time zone 'Europe/Paris','ends_at',r.ends_on::timestamp at time zone 'Europe/Paris') order by r.created_at,kind),'[]'::jsonb) from public.advertising_requests r cross join lateral jsonb_array_elements_text(coalesce(r.details->'placements',jsonb_build_array(r.placement))) as kind where r.event_id=new.event_id and r.payment_status='paid') where id=new.event_id;
 return new;
end $$;
create or replace function public.upgrade_managed_advertising(p_event_id uuid,p_token_hash text,p_placement text,p_ad jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare e public.events%rowtype; previous public.advertising_requests%rowtype; rid uuid;
 starts date:=(p_ad->>'startDate')::date; ends date:=(p_ad->>'endDate')::date;
 duration integer:=(p_ad->>'months')::integer; price integer;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or not exists(select 1 from public.event_owner_access where event_id=p_event_id and token_hash=p_token_hash) then raise exception 'Ongeldige beheerlink.';end if;
 price:=case p_placement when 'highlight' then 1500 when 'category' then 7900 when 'homepage' then 14900 else null end;
 if price is null or duration is null or duration not between 1 and 12 or starts is null or ends is null
 or starts<(now() at time zone 'Europe/Paris')::date or ends<>(starts+make_interval(months=>duration))::date
 or (p_ad->>'amountCents')::integer is distinct from price*duration or jsonb_typeof(p_ad->'details') is distinct from 'object'
 then raise exception 'Ongeldige advertentieaanvraag of periode.';end if;
 if e.status='rejected' then raise exception 'Deze vermelding is afgewezen. Neem contact op met de beheerder.';end if;
 if not e.is_directory_entry and coalesce(e.end_at,e.start_at)<now() then raise exception 'Dit evenement is afgelopen. Pas eerst de evenementdatum aan.';end if;
 if p_placement='category' and not exists(select 1 from public.event_categories where event_id=p_event_id) then raise exception 'Sla eerst een categorie op bij je vermelding.';end if;
 select * into previous from public.advertising_requests where event_id=p_event_id and (placement=p_placement or details->'placements' ? p_placement) order by created_at desc,id desc limit 1;
 if found and previous.payment_status in ('requested','open','paid') and previous.ends_on>(now() at time zone 'Europe/Paris')::date then
  if previous.placement=p_placement and previous.starts_on=starts and previous.ends_on=ends and previous.details=p_ad->'details' then return previous.id;end if;
  raise exception 'Er bestaat al een lopende advertentieaanvraag. Rond die eerst af of neem contact op met de beheerder.';
 end if;

 perform public.assert_advertising_capacity(p_event_id,p_placement,starts,ends);
 insert into public.advertising_requests(event_id,placement,details,starts_on,ends_on,months,amount_cents)
 values(p_event_id,p_placement,p_ad->'details',starts,ends,duration,price*duration) returning id into rid;
 -- Approval, content, category links and event identity remain untouched.
 update public.events set promotion_type=p_placement,promotion_status='requested',
 promotion_start_at=starts::timestamp at time zone 'Europe/Paris',promotion_end_at=ends::timestamp at time zone 'Europe/Paris',updated_at=now() where id=p_event_id and promotion_status<>'active';
 return rid;
end $$;
revoke all on function public.upgrade_managed_advertising(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.upgrade_managed_advertising(uuid,text,text,jsonb) to service_role;



create function public.request_managed_advertising_selection(p_event_id uuid,p_token_hash text,p_ad jsonb)
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
 if kinds ? 'category' and not exists(select 1 from public.event_categories where event_id=p_event_id) then raise exception 'Sla eerst een categorie op bij je vermelding.';end if;
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
create or replace function public.activate_paid_advertising() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' and new.verified and new.promotion_status='requested' and exists(
  select 1 from public.advertising_requests r where r.event_id=new.id and r.payment_status='paid'
   and r.placement=new.promotion_type
   and r.starts_on::timestamp at time zone 'Europe/Paris'=new.promotion_start_at
   and r.ends_on::timestamp at time zone 'Europe/Paris'=new.promotion_end_at
 ) then new.promotion_status:='active';end if;
 return new;
end $$;

notify pgrst,'reload schema';
commit;
