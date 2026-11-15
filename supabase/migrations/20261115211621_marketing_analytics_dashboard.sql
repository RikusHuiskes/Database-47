-- Existing measurements are preserved; legacy acquisition stays unknown.
alter table public.site_analytics add column acquisition jsonb;
create index site_analytics_visitor_time_idx on public.site_analytics(visitor_id,created_at);
alter table public.site_analytics add constraint site_analytics_acquisition_check check(acquisition is null or (jsonb_typeof(acquisition)='object' and octet_length(acquisition::text)<=2048));
alter table public.site_analytics drop constraint site_analytics_radius_km_check;
alter table public.site_analytics add constraint site_analytics_radius_km_check check(radius_km in (5,10,25,50));
alter table public.site_analytics drop constraint site_analytics_action_check;
alter table public.site_analytics add constraint site_analytics_action_check check(action in ('visit','page_view','filter_view','category_view','place_view','event_view','impression','outbound','advertising_start','checkout_start'));
alter table public.site_analytics drop constraint site_analytics_page_path_check;
alter table public.site_analytics add constraint site_analytics_page_path_check check(page_path in ('/','/statistieken','/handleiding','/contact','/disclaimer','/de-streek-beleven','/adverteren','/adverteren/betaling','/evenement/nieuw','/gemeentegids/adverteren','/gemeentegids/aanmelden'));
create or replace function public.record_site_analytics(p_data jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  e public.events%rowtype;
  v_event uuid := nullif(p_data->>'eventId','')::uuid;
  v_category uuid := nullif(p_data->>'categoryId','')::uuid;
  v_action text := p_data->>'action';
begin
  if v_action not in ('visit','page_view','filter_view','category_view','place_view','event_view','impression','outbound','advertising_start','checkout_start') then return false; end if;
  if v_action='page_view' and coalesce(p_data->>'page','') not in ('/','/statistieken','/handleiding','/contact','/disclaimer','/de-streek-beleven','/adverteren','/adverteren/betaling','/evenement/nieuw','/gemeentegids/adverteren','/gemeentegids/aanmelden') then return false; end if;
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

create function public.site_marketing_report(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; cutoff timestamptz:=now()-make_interval(days=>p_days);
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Alleen beheerders hebben toegang.' using errcode='42501'; end if;
 if p_days is null or p_days not in (7,30,90,365) then raise exception 'Ongeldige periode'; end if;
 with records as (select * from public.site_analytics where created_at>=cutoff-make_interval(days=>p_days)),
 metadata as (select distinct on(session_id) session_id,acquisition from public.site_analytics where action='visit' and acquisition is not null and created_at>=now()-interval '13 months' order by session_id,created_at),
 sessions as (
  select r.session_id,min(r.visitor_id::text) visitor,min(r.created_at) first_at,
   bool_or(r.created_at>=cutoff) current_period,
   bool_or(r.action in ('event_view','outbound') and r.created_at>=cutoff) engaged,
   bool_or(r.action='event_view' and r.created_at>=cutoff) details,
   bool_or(r.action='outbound' and r.created_at>=cutoff) outbound,
   bool_or(r.action='outbound' and r.channel='booking' and r.created_at>=cutoff) booking,
   bool_or(r.action='advertising_start' and r.created_at>=cutoff) advertising,
   bool_or(r.action='checkout_start' and r.created_at>=cutoff) checkout,
   bool_or(r.action in ('event_view','outbound') and r.created_at<cutoff) previous_engaged,
   bool_or(r.action='outbound' and r.created_at<cutoff) previous_outbound,
   bool_or(r.action='outbound' and r.channel='booking' and r.created_at<cutoff) previous_booking,
   bool_or(r.created_at<cutoff) previous_period
  from records r group by r.session_id
 ), current_sessions as (
  select s.*,m.acquisition from sessions s left join metadata m using(session_id) where current_period
 ), dimensions as (
  select s.session_id,s.visitor,s.engaged,s.details,s.outbound,s.booking,s.advertising,s.checkout,d.kind,d.name
  from current_sessions s cross join lateral (values
   ('channels',coalesce(s.acquisition->>'channel','unmeasured')),
   ('sources',case when s.acquisition is null then 'unmeasured' else coalesce(nullif(s.acquisition->>'source',''),nullif(s.acquisition->>'referrer',''),'direct')||' / '||coalesce(nullif(s.acquisition->>'medium',''),'—') end),
   ('campaigns',case when nullif(s.acquisition->>'campaign','') is null then null else coalesce(nullif(s.acquisition->>'source',''),'unknown')||' / '||coalesce(nullif(s.acquisition->>'medium',''),'—')||' / '||(s.acquisition->>'campaign') end),
   ('variants',case when nullif(s.acquisition->>'content','') is null then null else coalesce(nullif(s.acquisition->>'campaign',''),'unknown')||' / '||(s.acquisition->>'content') end),
   ('referrers',case when s.acquisition is null then 'unmeasured' else coalesce(nullif(s.acquisition->>'referrer',''),'direct') end),
   ('countries',coalesce(nullif(s.acquisition->>'country',''),'unknown')),
   ('devices',coalesce(nullif(s.acquisition->>'device',''),'unknown')),
   ('languages',coalesce(nullif(s.acquisition->>'language',''),'unknown')),
   ('landings',coalesce(nullif(s.acquisition->>'landing',''),'unmeasured'))
  ) d(kind,name) where d.name is not null
 ), grouped as (
  select kind,name,count(*) visits,count(distinct visitor) visitors,
   count(*) filter(where engaged) engaged,count(*) filter(where details) details,
   count(*) filter(where outbound) outbound,count(*) filter(where booking) bookings,
   count(*) filter(where advertising) advertising,count(*) filter(where checkout) checkouts
  from dimensions group by kind,name
 ), ranked as (select *,row_number() over(partition by kind order by visits desc,name) rank from grouped),
 lists as (select kind,jsonb_agg(to_jsonb(r)-'kind'-'rank' order by visits desc,name) items from ranked r where rank<=100 group by kind)
 select jsonb_build_object(
  'startedAt',(select min(created_at) from public.site_analytics where acquisition is not null),
  'summary',(select jsonb_build_object('visits',count(*),'visitors',count(distinct visitor),'attributed',count(*) filter(where acquisition is not null),'countryKnown',count(*) filter(where nullif(acquisition->>'country','') is not null),'engaged',count(*) filter(where engaged),'details',count(*) filter(where details),'outbound',count(*) filter(where outbound),'bookings',count(*) filter(where booking),'advertising',count(*) filter(where advertising),'checkouts',count(*) filter(where checkout)) from current_sessions),
  'previous',(select jsonb_build_object('visits',count(*),'visitors',count(distinct visitor),'engaged',count(*) filter(where previous_engaged),'outbound',count(*) filter(where previous_outbound),'bookings',count(*) filter(where previous_booking)) from sessions where previous_period),
  'returningVisitors',(select count(distinct visitor) from current_sessions s where exists(select 1 from public.site_analytics old where old.visitor_id::text=s.visitor and old.created_at<cutoff and old.created_at>=now()-interval '13 months'))
 )||coalesce((select jsonb_object_agg(kind,items) from lists),'{}'::jsonb) into result;
 return result;
end $$;
revoke all on function public.site_marketing_report(integer) from public,anon;
grant execute on function public.site_marketing_report(integer) to authenticated;
notify pgrst,'reload schema';

