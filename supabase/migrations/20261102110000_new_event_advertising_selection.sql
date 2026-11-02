-- Save the new listing, owner access and ONE combined order atomically.
-- Existing single-placement submissions remain supported by the original RPC.
create or replace function public.submit_managed_event_selection(p_event jsonb,p_category_id uuid,p_token_hash text,p_ad jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare kinds jsonb:=p_ad->'details'->'placements'; price integer; single_price integer; primary_kind text; eid uuid;
 starts date:=(p_ad->>'startDate')::date; ends date:=(p_ad->>'endDate')::date; duration integer:=(p_ad->>'months')::integer;
begin
 if jsonb_typeof(kinds) is distinct from 'array' then raise exception 'Kies geldige advertentievormen.';end if;
 if jsonb_array_length(kinds) not between 1 and 3
 or exists(select 1 from jsonb_array_elements_text(kinds) k where k not in ('highlight','category','homepage') or k is null)
 or (select count(distinct k) from jsonb_array_elements_text(kinds) k)<>jsonb_array_length(kinds) then raise exception 'Kies geldige advertentievormen.';end if;
 select jsonb_agg(k order by k) into kinds from jsonb_array_elements_text(kinds) k;
 if kinds ? 'category' and p_category_id is null then raise exception 'Kies een categorie.';end if;
 select sum(case k when 'highlight' then 1500 when 'category' then 7900 when 'homepage' then 14900 end)::integer into price from jsonb_array_elements_text(kinds) k;
 if duration is null or duration not between 1 and 12 or starts is null or ends is null
 or starts<(now() at time zone 'Europe/Paris')::date or ends<>(starts+make_interval(months=>duration))::date
 or (p_ad->>'amountCents')::integer is distinct from price*duration then raise exception 'Ongeldige advertentieaanvraag of periode.';end if;
 primary_kind:=kinds->>0;
 single_price:=case primary_kind when 'homepage' then 14900 when 'category' then 7900 else 1500 end;
 p_ad:=jsonb_set(p_ad,'{details,placements}',kinds);
 eid:=public.submit_managed_event(p_event||jsonb_build_object('promotion_type',primary_kind),p_category_id,p_token_hash,
   p_ad||jsonb_build_object('amountCents',single_price*duration));
 update public.advertising_requests set amount_cents=price*duration,details=p_ad->'details' where event_id=eid;
 return eid;
end $$;
revoke all on function public.submit_managed_event_selection(jsonb,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_managed_event_selection(jsonb,uuid,text,jsonb) to service_role;
