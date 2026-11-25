alter table public.site_analytics drop constraint site_analytics_page_path_check;
alter table public.site_analytics add constraint site_analytics_page_path_check check(page_path in ('/','/travaux','/statistieken','/handleiding','/contact','/disclaimer','/de-streek-beleven','/adverteren','/adverteren/betaling','/evenement/nieuw','/gemeentegids/adverteren','/gemeentegids/aanmelden'));
create or replace function public.record_site_analytics(p_data jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  e public.events%rowtype;
  v_event uuid := nullif(p_data->>'eventId','')::uuid;
  v_category uuid := nullif(p_data->>'categoryId','')::uuid;
  v_action text := p_data->>'action';
begin
  if v_action not in ('visit','page_view','filter_view','category_view','place_view','event_view','impression','outbound','advertising_start','checkout_start') then return false; end if;
  if v_action='page_view' and coalesce(p_data->>'page','') not in ('/','/travaux','/statistieken','/handleiding','/contact','/disclaimer','/de-streek-beleven','/adverteren','/adverteren/betaling','/evenement/nieuw','/gemeentegids/adverteren','/gemeentegids/aanmelden') then return false; end if;
  if v_action='filter_view' and coalesce(p_data->>'radius','') not in ('5','10','25','50') then return false; end if;
  if (select count(*) from public.site_analytics where session_id=(p_data->>'sessionId')::uuid and created_at>now()-interval '1 minute')>=120 then return false; end if;
  if v_event is not null then
    select * into e from public.events where id=v_event and status='approved' and verified=true;
    if not found then return false; end if;
  end if;
  if v_action in ('event_view','impression','outbound') and v_event is null then return false; end if;
  if v_category is not null and not exists(select 1 from public.categories where id=v_category) then return false; end if;
  insert into public.site_analytics(id,visitor_id,session_id,consent_at,action,event_id,event_title,category_id,area,placement,channel,page_path,radius_km,acquisition)
  values((p_data->>'id')::uuid,(p_data->>'visitorId')::uuid,(p_data->>'sessionId')::uuid,(p_data->>'consentAt')::timestamptz,
    v_action,v_event,e.title,v_category,left(p_data->>'area',100),coalesce(p_data->>'placement','standard'),p_data->>'channel',p_data->>'page',nullif(p_data->>'radius','')::integer,case when v_action='visit' then p_data->'acquisition' else null end)
  on conflict do nothing;
  delete from public.site_analytics where created_at<now()-interval '13 months';
  return true;
end $$;
revoke all on function public.record_site_analytics(jsonb) from public,anon,authenticated;
grant execute on function public.record_site_analytics(jsonb) to service_role;


create or replace function public.travaux_analytics(p_days integer default 30) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'pageviews', (select count(*) from public.site_analytics where action='page_view' and page_path='/travaux' and created_at>=now()-make_interval(days=>p_days)),
    'visits', (select count(distinct session_id) from public.site_analytics where action='page_view' and page_path='/travaux' and created_at>=now()-make_interval(days=>p_days)),
    'visitors', (select count(distinct visitor_id) from public.site_analytics where action='page_view' and page_path='/travaux' and created_at>=now()-make_interval(days=>p_days)),
    'projects', (select count(*) from public.travaux_jobs),
    'open', (select count(*) from public.travaux_jobs where status='open'),
    'requesters', (select count(distinct owner_id) from public.travaux_jobs),
    'replies', (select count(*) from public.travaux_responses),
    'matched', (select count(distinct job_id) from public.travaux_responses),
    'providers', (select count(*) from public.travaux_providers where test_mode=false),
    'active', (select count(*) from public.travaux_providers p where p.test_mode=false and public.travaux_paid(p.user_id,false))
  );
$$;
revoke all on function public.travaux_analytics(integer) from public, anon, authenticated;
grant execute on function public.travaux_analytics(integer) to service_role;
