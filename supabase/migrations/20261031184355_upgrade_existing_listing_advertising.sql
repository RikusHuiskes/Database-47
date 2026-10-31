begin;
-- Owner authentication is checked again inside the transaction. Never grant this
-- operation to public clients; it runs with the service client's privileges.
create function public.upgrade_managed_advertising(p_event_id uuid,p_token_hash text,p_placement text,p_ad jsonb)
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
 select * into previous from public.advertising_requests where event_id=p_event_id order by created_at desc,id desc limit 1;
 if found and previous.payment_status in ('requested','open','paid') and previous.ends_on>(now() at time zone 'Europe/Paris')::date then
  if previous.placement=p_placement and previous.starts_on=starts and previous.ends_on=ends and previous.details=p_ad->'details' then return previous.id;end if;
  raise exception 'Er bestaat al een lopende advertentieaanvraag. Rond die eerst af of neem contact op met de beheerder.';
 end if;
 if e.promotion_status='active' and (e.promotion_end_at is null or e.promotion_end_at>now()) then raise exception 'Deze vermelding heeft al een actieve advertentie.';end if;
 perform public.assert_advertising_capacity(p_event_id,p_placement,starts,ends);
 insert into public.advertising_requests(event_id,placement,details,starts_on,ends_on,months,amount_cents)
 values(p_event_id,p_placement,p_ad->'details',starts,ends,duration,price*duration) returning id into rid;
 -- Approval, content, category links and event identity remain untouched.
 update public.events set promotion_type=p_placement,promotion_status='requested',
 promotion_start_at=starts::timestamp at time zone 'Europe/Paris',promotion_end_at=ends::timestamp at time zone 'Europe/Paris',updated_at=now() where id=p_event_id;
 return rid;
end $$;
revoke all on function public.upgrade_managed_advertising(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.upgrade_managed_advertising(uuid,text,text,jsonb) to service_role;

-- A payment for an old period must never activate a newly requested upgrade.
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
