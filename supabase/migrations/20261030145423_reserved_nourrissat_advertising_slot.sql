begin;
alter table public.events add column reserved_homepage boolean not null default false;
alter table public.events add column reserved_category_id uuid references public.categories(id);
create unique index events_one_reserved_homepage on public.events(reserved_homepage) where reserved_homepage;
create unique index events_one_reserved_category on public.events(reserved_category_id) where reserved_category_id is not null;

-- A permanent accommodation is not an expired calendar event. This is an
-- explicit house placement, not a fabricated payment or payment confirmation.
update public.events set is_directory_entry=true,start_at=null,end_at=null,reserved_homepage=true,
 reserved_category_id=(select id from public.categories where slug='hotels-chambres-hotes-gites'),updated_at=now()
 where id='1f4ce2cd-398d-45ab-989c-15c128818cca';

-- The preview contained nine example ads in each frame. Free one demo place
-- in these two frames; retain the records so the test change is reversible.
with examples as (
 select e.id,row_number() over(partition by e.promotion_type order by e.id desc) as n
 from public.events e where e.slug like 'demo-layout-20261030-%' and e.promotion_status='active'
 and (e.promotion_type='homepage' or (e.promotion_type='category' and exists(select 1 from public.event_categories ec join public.categories c on c.id=ec.category_id where ec.event_id=e.id and c.slug='hotels-chambres-hotes-gites')))
)
update public.events set promotion_status='ended' where id in (select id from examples where n=1);

create function public.assert_advertising_capacity(p_event_id uuid,p_placement text,p_starts_on date,p_ends_on date) returns void
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
  where r.event_id<>p_event_id and r.placement=p_placement and r.payment_status in ('open','paid')
   and not(case when p_placement='homepage' then e.reserved_homepage else coalesce(e.reserved_category_id=cid,false) end)
   and (p_placement='homepage' or exists(select 1 from public.event_categories ec where ec.event_id=e.id and ec.category_id=cid))
 ), points as (select period_start as t union select starts from intervals where starts<ends)
 select coalesce(max(n),0)::integer into occupied from (select count(distinct i.id) n from points p left join intervals i on i.starts<=p.t and p.t<i.ends group by p.t) counts;
 if occupied>=capacity then raise exception 'Geen advertentieplek beschikbaar in deze periode. Op deze plaats zijn maximaal % overige betaalde advertenties mogelijk.',capacity;end if;
end $$;
revoke all on function public.assert_advertising_capacity(uuid,text,date,date) from public,anon,authenticated;
grant execute on function public.assert_advertising_capacity(uuid,text,date,date) to service_role;

create function public.enforce_advertising_capacity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.payment_status in ('open','paid') then perform public.assert_advertising_capacity(new.event_id,new.placement,new.starts_on,new.ends_on);end if;
 return new;
end $$;
revoke all on function public.enforce_advertising_capacity() from public,anon,authenticated;
grant execute on function public.enforce_advertising_capacity() to service_role;
create trigger enforce_advertising_capacity before insert or update of payment_status,starts_on,ends_on,placement on public.advertising_requests for each row execute function public.enforce_advertising_capacity();
notify pgrst,'reload schema';
commit;
