begin;
create table public.advertiser_access(
 request_id uuid primary key references public.advertising_requests(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 encrypted_secret text not null, locale text not null check(locale in ('nl','en','fr')),
 rate_key text not null, email_key text not null,
 created_at timestamptz not null default now(), mail_state text not null default 'pending' check(mail_state in ('pending','sending','accepted','failed')),
 mail_attempts integer not null default 0,mail_lease timestamptz,mail_error text
);
alter table public.advertiser_access enable row level security;
revoke all on public.advertiser_access from public,anon,authenticated;
grant all on public.advertiser_access to service_role;
create index advertiser_access_rate on public.advertiser_access(rate_key,created_at);
create index advertiser_access_email_rate on public.advertiser_access(email_key,created_at);
create function public.request_public_advertising(p_id uuid,p_event_id uuid,p_token_hash text,p_secret text,p_locale text,p_rate_key text,p_email_key text,p_ad jsonb,p_test boolean,p_monthly boolean,p_method text,p_terms text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare e public.events%rowtype; kinds jsonb:=p_ad->'details'->'placements';k text;price integer;
 starts date:=(p_ad->>'startDate')::date;ends date:=(p_ad->>'endDate')::date;duration integer:=(p_ad->>'months')::integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public-ad-id:'||p_id::text,0));
 if exists(select 1 from public.advertiser_access where request_id=p_id and token_hash=p_token_hash) then return p_id;end if;
 if exists(select 1 from public.advertising_requests where id=p_id) then raise exception 'Deze aanvraag bestaat al.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public-ad-rate:'||p_rate_key,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public-ad-email:'||p_email_key,0));
 if (select count(*) from public.advertiser_access where rate_key=p_rate_key and created_at>now()-interval '1 hour')>=10 or
 (select count(*) from public.advertiser_access where email_key=p_email_key and created_at>now()-interval '1 hour')>=5 then raise exception 'Te veel aanvragen. Probeer het later opnieuw.';end if;
 select * into e from public.events where id=p_event_id for update;
 if not found or e.archived_at is not null or e.status<>'approved' or not e.verified or (not e.is_directory_entry and coalesce(e.end_at,e.start_at)<now()) then raise exception 'Deze vermelding is niet beschikbaar voor adverteren.';end if;
 if jsonb_typeof(kinds) is distinct from 'array' then raise exception 'Kies een advertentievorm.';end if;
 if jsonb_array_length(kinds) not between 1 and 3 or exists(select 1 from jsonb_array_elements_text(kinds) t where t not in ('highlight','category','homepage')) or (select count(distinct t) from jsonb_array_elements_text(kinds) t)<>jsonb_array_length(kinds) then raise exception 'Ongeldige advertentievorm.';end if;
 select sum(case t when 'highlight' then 1500 when 'category' then 7900 when 'homepage' then 14900 end)::integer into price from jsonb_array_elements_text(kinds) t;
 if duration is null or duration not between 1 and 12 or starts is null or ends is null or starts<(now() at time zone 'Europe/Paris')::date or ends<>(starts+make_interval(months=>duration))::date or (p_ad->>'amountCents')::integer is distinct from price*duration or (p_monthly and duration<>1) then raise exception 'Ongeldig bedrag of periode.';end if;
 if e.municipal_key is null and kinds ? 'category' and not exists(select 1 from public.event_categories where event_id=p_event_id) then raise exception 'Deze vermelding heeft geen advertentiecategorie.';end if;
 if exists(select 1 from public.advertising_requests r where r.event_id=p_event_id and not r.is_test_mode and r.payment_status in ('open','paid') and r.starts_on<ends and starts<r.ends_on and exists(select 1 from jsonb_array_elements_text(kinds) t where r.placement=t or r.details->'placements' ? t)) or exists(select 1 from public.advertising_contracts c join public.advertising_requests r on r.id=c.request_id where c.event_id=p_event_id and not c.is_test_mode and c.status='active' and exists(select 1 from jsonb_array_elements_text(kinds) t where r.details->'placements' ? t)) then raise exception 'Een gekozen advertentievorm is al actief of wordt betaald.';end if;
 for k in select jsonb_array_elements_text(kinds) order by 1 loop perform public.assert_advertising_capacity(p_event_id,k,starts,ends);end loop;
 insert into public.advertising_requests(id,event_id,placement,details,starts_on,ends_on,months,amount_cents,is_test_mode) values(p_id,p_event_id,kinds->>0,p_ad->'details',starts,ends,duration,price*duration,p_test);
 insert into public.advertiser_access(request_id,token_hash,encrypted_secret,locale,rate_key,email_key) values(p_id,p_token_hash,p_secret,p_locale,p_rate_key,p_email_key);
 if p_monthly then perform public.prepare_monthly_contract(p_id,p_method,p_terms,p_locale,p_test);end if;
 return p_id;
end $$;
revoke all on function public.request_public_advertising(uuid,uuid,text,text,text,text,text,jsonb,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.request_public_advertising(uuid,uuid,text,text,text,text,text,jsonb,boolean,boolean,text,text) to service_role;
notify pgrst,'reload schema';
commit;
