begin;
-- Public, payment-free presentation data. Billing details and payment references
-- remain exclusively in the protected advertising_requests table.
alter table public.events add column advertising_placements jsonb;
create function public.sync_event_advertising_placements() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.events set advertising_placements=(select coalesce(jsonb_agg(jsonb_build_object('placement',r.placement,'starts_at',r.starts_on::timestamp at time zone 'Europe/Paris','ends_at',r.ends_on::timestamp at time zone 'Europe/Paris') order by r.created_at),'[]'::jsonb) from public.advertising_requests r where r.event_id=new.event_id and r.payment_status='paid') where id=new.event_id;
 return new;
end $$;
revoke all on function public.sync_event_advertising_placements() from public,anon,authenticated;
create trigger sync_event_advertising_placements after insert or update of payment_status,starts_on,ends_on,placement on public.advertising_requests for each row execute function public.sync_event_advertising_placements();
update public.events e set advertising_placements=(select coalesce(jsonb_agg(jsonb_build_object('placement',r.placement,'starts_at',r.starts_on::timestamp at time zone 'Europe/Paris','ends_at',r.ends_on::timestamp at time zone 'Europe/Paris') order by r.created_at),'[]'::jsonb) from public.advertising_requests r where r.event_id=e.id and r.payment_status='paid') where exists(select 1 from public.advertising_requests r where r.event_id=e.id);
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
 select * into previous from public.advertising_requests where event_id=p_event_id and placement=p_placement order by created_at desc,id desc limit 1;
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


create or replace function public.settle_advertising_payment(p_payment_id text,p_state text) returns void language plpgsql security definer set search_path='' as $body$
declare request public.advertising_requests%rowtype;
begin
 if p_state not in ('open','paid','failed','canceled','expired','refunded') then raise exception 'Ongeldige betaalstatus.';end if;
 select * into strict request from public.advertising_requests where mollie_payment_id=p_payment_id for update;
 update public.advertising_requests set payment_status=p_state where id=request.id;
 if p_state='paid' then
  update public.events set promotion_type=request.placement,promotion_status=case when status='approved' and verified then 'active' else 'requested' end,
   promotion_start_at=request.starts_on::timestamp at time zone 'Europe/Paris',promotion_end_at=request.ends_on::timestamp at time zone 'Europe/Paris'
   where id=request.event_id;
 elsif p_state='refunded' then
  select * into request from public.advertising_requests where event_id=request.event_id and payment_status='paid' order by created_at desc limit 1;
  if found then
   update public.events set promotion_type=request.placement,promotion_status=case when status='approved' and verified then 'active' else 'requested' end,promotion_start_at=request.starts_on::timestamp at time zone 'Europe/Paris',promotion_end_at=request.ends_on::timestamp at time zone 'Europe/Paris' where id=request.event_id;
  else
   update public.events set promotion_status='ended' where id=(select event_id from public.advertising_requests where mollie_payment_id=p_payment_id);
  end if;
 end if;
end $body$;
revoke all on function public.settle_advertising_payment(text,text) from public,anon,authenticated;
grant execute on function public.settle_advertising_payment(text,text) to service_role;


notify pgrst,'reload schema';
commit;
