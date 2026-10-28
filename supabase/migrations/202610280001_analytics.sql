begin;
create table if not exists public.site_analytics (
  id uuid primary key,
  created_at timestamptz not null default now(),
  visitor_id uuid not null,
  session_id uuid not null,
  consent_at timestamptz not null,
  action text not null check(action in ('visit','page_view','filter_view','category_view','place_view','event_view','impression','outbound')),
  page_path text check(page_path in ('/','/statistieken')),
  radius_km integer check(radius_km in (10,25,50)),
  event_id uuid,
  event_title text,
  category_id uuid,
  area text,
  placement text not null default 'standard',
  channel text
);
create index if not exists site_analytics_date_idx on public.site_analytics(created_at);
create index if not exists site_analytics_session_idx on public.site_analytics(session_id,created_at);
create unique index if not exists site_analytics_visit_once on public.site_analytics(session_id) where action='visit';
create unique index if not exists site_analytics_impression_once on public.site_analytics(session_id,event_id,placement) where action='impression';
alter table public.site_analytics enable row level security;
revoke all on public.site_analytics from anon, authenticated;

create or replace function public.record_site_analytics(p_data jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  e public.events%rowtype;
  v_event uuid := nullif(p_data->>'eventId','')::uuid;
  v_category uuid := nullif(p_data->>'categoryId','')::uuid;
  v_action text := p_data->>'action';
begin
  if v_action not in ('visit','page_view','filter_view','category_view','place_view','event_view','impression','outbound') then return false; end if;
  if v_action='page_view' and coalesce(p_data->>'page','') not in ('/','/statistieken') then return false; end if;
  if v_action='filter_view' and coalesce(p_data->>'radius','') not in ('10','25','50') then return false; end if;
  if (select count(*) from public.site_analytics where session_id=(p_data->>'sessionId')::uuid and created_at>now()-interval '1 minute')>=120 then return false; end if;
  if v_event is not null then
    select * into e from public.events where id=v_event and status='approved' and verified=true;
    if not found then return false; end if;
  end if;
  if v_action in ('event_view','impression','outbound') and v_event is null then return false; end if;
  if v_category is not null and not exists(select 1 from public.categories where id=v_category) then return false; end if;
  insert into public.site_analytics(id,visitor_id,session_id,consent_at,action,event_id,event_title,category_id,area,placement,channel,page_path,radius_km)
  values((p_data->>'id')::uuid,(p_data->>'visitorId')::uuid,(p_data->>'sessionId')::uuid,(p_data->>'consentAt')::timestamptz,
    v_action,v_event,e.title,v_category,left(p_data->>'area',100),coalesce(p_data->>'placement','standard'),p_data->>'channel',p_data->>'page',nullif(p_data->>'radius','')::integer)
  on conflict do nothing;
  delete from public.site_analytics where created_at<now()-interval '13 months';
  return true;
end $$;
revoke all on function public.record_site_analytics(jsonb) from public,anon,authenticated;
grant execute on function public.record_site_analytics(jsonb) to service_role;

create or replace function public.site_analytics_report(p_days integer default 30) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; cutoff timestamptz := now()-make_interval(days=>greatest(1,least(365,p_days)));
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Alleen beheerders hebben toegang.' using errcode='42501'; end if;
  with records as (select * from public.site_analytics where created_at>=cutoff),
  category_hits as (
    select r.id,r.visitor_id,r.session_id,r.action,r.category_id from records r where r.category_id is not null
    union
    select r.id,r.visitor_id,r.session_id,r.action,ec.category_id from records r join public.event_categories ec on ec.event_id=r.event_id
  ),
  category_rows as (
    select c.name, count(distinct h.visitor_id) as visitors,count(distinct h.session_id) as visits,
      count(distinct h.id) filter(where h.action='category_view') as selections,
      count(distinct h.id) filter(where h.action='event_view') as views,
      count(distinct h.id) filter(where h.action='outbound') as clicks
    from category_hits h join public.categories c on c.id=h.category_id group by c.id,c.name
  ),
  event_rows as (
    select r.event_id,max(r.event_title) as name,
      count(*) filter(where r.action='impression') as impressions,
      count(*) filter(where r.action='event_view') as views,
      count(*) filter(where r.action='outbound') as clicks,
      count(*) filter(where r.action='outbound' and channel='booking') as bookings,
      count(distinct r.visitor_id) as visitors,
      count(distinct r.session_id) filter(where r.action='impression') as reached_sessions,
      count(distinct r.session_id) filter(where r.action='outbound' and exists(
        select 1 from records i where i.event_id=r.event_id and i.session_id=r.session_id and i.action='impression' and i.created_at<=r.created_at
      )) as clicked_sessions
    from records r where event_id is not null group by r.event_id
  )
  select jsonb_build_object(
    'generatedAt',now(),'days',greatest(1,least(365,p_days)),
    'firstMeasuredAt',(select min(created_at) from public.site_analytics),
    'totalMeasuredVisitors',(select count(distinct visitor_id) from public.site_analytics where created_at>=now()-interval '13 months'),
    'summary',(select jsonb_build_object('visitors',count(distinct visitor_id),'visits',count(distinct session_id),'pageviews',count(*) filter(where action='page_view'),
      'views',count(*) filter(where action='event_view'),'impressions',count(*) filter(where action='impression'),
      'clicks',count(*) filter(where action='outbound')) from records),
    'daily',coalesce((select jsonb_agg(x order by x.day) from (
      select (created_at at time zone 'Europe/Paris')::date as day,count(distinct visitor_id) as visitors,count(distinct session_id) as visits
      from records group by 1) x),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(x order by x.visitors desc) from category_rows x),'[]'::jsonb),
    'monthly',coalesce((select jsonb_agg(x order by x.month) from (
      select to_char(created_at at time zone 'Europe/Paris','YYYY-MM') as month,count(distinct visitor_id) as visitors,count(distinct session_id) as visits,count(*) filter(where action='page_view') as pageviews from records group by 1) x),'[]'::jsonb),
    'pages',coalesce((select jsonb_agg(x order by x.views desc) from (
      select page_path as name,count(*) as views,count(distinct visitor_id) as visitors from records where action='page_view' group by page_path) x),'[]'::jsonb),
    'filters',coalesce((select jsonb_agg(x order by x.uses desc) from (
      select r.area,c.name as category,r.radius_km,count(*) as uses from records r left join public.categories c on c.id=r.category_id where r.action='filter_view' group by r.area,c.name,r.radius_km) x),'[]'::jsonb),
    'places',coalesce((select jsonb_agg(x order by x.visitors desc) from (
      select area as name,count(distinct visitor_id) as visitors,count(*) as searches from records where action='place_view' and area is not null group by area) x),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(x order by x.views desc,x.clicks desc) from event_rows x),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.site_analytics_report(integer) from public,anon;
grant execute on function public.site_analytics_report(integer) to authenticated;
create or replace function public.prune_site_analytics() returns void
language sql security definer set search_path='' as $$
  delete from public.site_analytics where created_at<now()-interval '13 months';
$$;
revoke all on function public.prune_site_analytics() from public,anon,authenticated;
grant execute on function public.prune_site_analytics() to service_role;
commit;
