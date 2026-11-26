create table public.travaux_interactions (
  id uuid primary key,
  session_id uuid not null,
  kind text not null check (kind in (
    'site_entry','site_exit','tab_intro','tab_jobs','tab_guide','tab_contact','language_change',
    'browse_jobs','view_job_card','filter_trade','filter_town','reset_filters','recommendations','all_jobs','refresh_jobs','more_jobs',
    'start_project','my_projects','requester_login','project_email_verification','submit_project','close_project',
    'register','professional_login','professional_link','professional_account','plan_monthly','plan_annual','checkout','resume_checkout',
    'cancel_subscription','reply','quote','send_quote','open_email','copy_email','download_invoice','submit_contact'
  )),
  created_at timestamptz not null default now()
);
create index on public.travaux_interactions (created_at);
create index on public.travaux_interactions (session_id, created_at);
alter table public.travaux_interactions enable row level security;
revoke all on public.travaux_interactions from public,anon,authenticated;
grant select,insert,delete on public.travaux_interactions to service_role;

-- Existing rows have no reliable registration or reply timestamp.
alter table public.travaux_providers add column analytics_registered_at timestamptz;
alter table public.travaux_providers alter column analytics_registered_at set default now();
alter table public.travaux_responses add column analytics_replied_at timestamptz;
alter table public.travaux_responses alter column analytics_replied_at set default now();

create function public.record_travaux_interaction(p_id uuid, p_session uuid, p_kind text)
returns boolean language plpgsql set search_path='' as $$
begin
  if (select count(*) from public.travaux_interactions where session_id=p_session and created_at>now()-interval '1 minute') >= 120 then
    return false;
  end if;
  insert into public.travaux_interactions(id,session_id,kind) values(p_id,p_session,p_kind)
    on conflict (id) do nothing;
  return true;
end $$;
revoke all on function public.record_travaux_interaction(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_travaux_interaction(uuid,uuid,text) to service_role;

create function public.travaux_interaction_report(p_days integer)
returns jsonb language sql stable set search_path='' as $$
  with bounds as (
    select (now() at time zone 'Europe/Paris')::date as today,
      (now() at time zone 'Europe/Paris')::date - (greatest(1,least(90,coalesce(p_days,30))) - 1) as first_day
  ), dates as (
    select (b.first_day+i)::date as day from bounds b cross join lateral generate_series(0,b.today-b.first_day) i
  ), events as (
    select i.kind, i.session_id, (i.created_at at time zone 'Europe/Paris')::date as day
    from public.travaux_interactions i,bounds b
    where i.created_at >= b.first_day::timestamp at time zone 'Europe/Paris'
  ), pages as (
    select a.session_id, a.visitor_id, (a.created_at at time zone 'Europe/Paris')::date as day
    from public.site_analytics a,bounds b
    where a.action='page_view' and a.page_path='/travaux'
      and a.created_at >= b.first_day::timestamp at time zone 'Europe/Paris'
  ), projects as (
    select (created_at at time zone 'Europe/Paris')::date as day, j.category, j.commune
    from public.travaux_jobs j,bounds b
    where j.created_at >= b.first_day::timestamp at time zone 'Europe/Paris'
  ), replies as (
    select (r.analytics_replied_at at time zone 'Europe/Paris')::date as day
    from public.travaux_responses r
    join public.travaux_providers p on p.user_id=r.provider_id
    cross join bounds b
    where not p.test_mode and r.analytics_replied_at >= b.first_day::timestamp at time zone 'Europe/Paris'
  ), registrations as (
    select (p.analytics_registered_at at time zone 'Europe/Paris')::date as day
    from public.travaux_providers p,bounds b
    where not p.test_mode and p.analytics_registered_at >= b.first_day::timestamp at time zone 'Europe/Paris'
  ), payments as (
    select p.starts_on as day
    from public.travaux_payments p
    join public.travaux_providers pro on pro.user_id=p.provider_id
    cross join bounds b
    where not pro.test_mode and p.paid and p.starts_on between b.first_day and b.today
  ), channel_counts as (
    select coalesce(a.acquisition->>'channel','unknown') as key,count(*) as count
    from (select distinct session_id from pages) s
    left join lateral (
      select acquisition from public.site_analytics a where a.session_id=s.session_id and a.action='visit'
      order by created_at limit 1
    ) a on true
    group by 1
  )
  select jsonb_build_object(
    'traffic', (select jsonb_build_object('visits',count(distinct session_id),'visitors',count(distinct visitor_id),'pageviews',count(*)) from pages),
    'events', coalesce((select jsonb_object_agg(kind,jsonb_build_object('count',total,'visits',sessions))
      from (select kind,count(*) as total,count(distinct session_id) as sessions from events group by kind) e),'{}'::jsonb),
    'operations', jsonb_build_object(
      'submitted',(select count(*) from projects),
      'accepted',(select count(*) from replies),
      'newProviders',(select count(*) from registrations),
      'paid',(select count(*) from payments),
      'cancelled',(select count(*) from public.travaux_providers p,bounds b
        where not p.test_mode and p.cancelled_at>=b.first_day::timestamp at time zone 'Europe/Paris')
    ),
    'daily', (select jsonb_agg(jsonb_build_object(
      'day',d.day,'visits',(select count(distinct session_id) from pages where day=d.day),
      'interactions',(select count(*) from events where day=d.day),
      'projects',(select count(*) from projects where day=d.day),
      'replies',(select count(*) from replies where day=d.day),
      'payments',(select count(*) from payments where day=d.day)
    ) order by d.day) from dates d),
    'categories', coalesce((select jsonb_agg(to_jsonb(x) order by x.count desc,x.key) from
      (select category as key,count(*) from projects group by category order by count(*) desc,category limit 10) x),'[]'::jsonb),
    'towns', coalesce((select jsonb_agg(to_jsonb(x) order by x.count desc,x.key) from
      (select commune as key,count(*) from projects group by commune order by count(*) desc,commune limit 10) x),'[]'::jsonb),
    'channels', coalesce((select jsonb_agg(to_jsonb(channel_counts) order by count desc,key) from channel_counts),'[]'::jsonb)
  );
$$;
revoke all on function public.travaux_interaction_report(integer) from public,anon,authenticated;
grant execute on function public.travaux_interaction_report(integer) to service_role;

-- The existing daily cleanup job prunes both analytics tables.
create or replace function public.prune_site_analytics() returns void
language sql security definer set search_path='' as $$
  delete from public.site_analytics where created_at < now()-interval '13 months';
  delete from public.travaux_interactions where created_at < now()-interval '13 months';
$$;
revoke all on function public.prune_site_analytics() from public,anon,authenticated;
grant execute on function public.prune_site_analytics() to service_role;
